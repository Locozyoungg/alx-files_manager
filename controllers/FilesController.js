import { tmpdir } from 'os';
import { promisify } from 'util';
import Queue from 'bull/lib/queue';
import { v4 as uuidv4 } from 'uuid';
import { mkdir, writeFile, stat, existsSync, realpath } from 'fs';
import { join as joinPath } from 'path';
import { Request, Response } from 'express';
import { contentType } from 'mime-types';
import mongoDBCore from 'mongodb/lib/core';
import dbClient from '../utils/db';
import { getUserFromXToken } from '../utils/auth';

const VALID_FILE_TYPES = {
  folder: 'folder',
  file: 'file',
  image: 'image',
};
const ROOT_FOLDER_ID = '0';
const DEFAULT_ROOT_FOLDER = 'files_manager';
const mkDirAsync = promisify(mkdir);
const writeFileAsync = promisify(writeFile);
const statAsync = promisify(stat);
const realpathAsync = promisify(realpath);
const MAX_FILES_PER_PAGE = 20;
const fileQueue = new Queue('thumbnail generation');
const NULL_ID = '0'.repeat(24);

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

const sendErrorResponse = (res, status, message) => res.status(status).json({ error: message });

export default class FilesController {
  static async postUpload(req, res) {
    const { user } = req;
    const { name, type, parentId = ROOT_FOLDER_ID, isPublic = false, data = '' } = req.body || {};

    if (!name) return sendErrorResponse(res, 400, 'Missing name');
    if (!type || !Object.values(VALID_FILE_TYPES).includes(type)) return sendErrorResponse(res, 400, 'Invalid type');
    if (type !== VALID_FILE_TYPES.folder && !data) return sendErrorResponse(res, 400, 'Missing data');

    if (parentId !== ROOT_FOLDER_ID) {
      const parentFile = await (await dbClient.filesCollection())
        .findOne({ _id: new mongoDBCore.BSON.ObjectId(isValidId(parentId) ? parentId : NULL_ID) });
      if (!parentFile || parentFile.type !== VALID_FILE_TYPES.folder) return sendErrorResponse(res, 400, 'Invalid parent folder');
    }

    const userId = user._id.toString();
    const baseDir = process.env.FOLDER_PATH?.trim() || joinPath(tmpdir(), DEFAULT_ROOT_FOLDER);
    await mkDirAsync(baseDir, { recursive: true });

    const newFile = {
      userId: new mongoDBCore.BSON.ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === ROOT_FOLDER_ID ? ROOT_FOLDER_ID : new mongoDBCore.BSON.ObjectId(parentId),
    };

    if (type !== VALID_FILE_TYPES.folder) {
      const localPath = joinPath(baseDir, uuidv4());
      await writeFileAsync(localPath, Buffer.from(data, 'base64'));
      newFile.localPath = localPath;
    }

    const { insertedId } = await (await dbClient.filesCollection()).insertOne(newFile);
    const fileId = insertedId.toString();

    if (type === VALID_FILE_TYPES.image) {
      fileQueue.add({ userId, fileId, name: `Image thumbnail [${userId}-${fileId}]` });
    }

    res.status(201).json({ id: fileId, ...newFile });
  }

  static async getShow(req, res) {
    const { user } = req;
    const id = req.params?.id || NULL_ID;
    const userId = user._id.toString();
    const file = await (await dbClient.filesCollection())
      .findOne({ _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID), userId: new mongoDBCore.BSON.ObjectId(userId) });

    if (!file) return sendErrorResponse(res, 404, 'Not found');

    res.status(200).json({
      id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId === ROOT_FOLDER_ID ? 0 : file.parentId.toString(),
    });
  }

  static async getIndex(req, res) {
    const { user } = req;
    const parentId = req.query.parentId || ROOT_FOLDER_ID;
    const page = Number.parseInt(req.query.page || '0', 10) || 0;

    const files = await (await dbClient.filesCollection())
      .aggregate([
        { $match: { userId: user._id, parentId: parentId === ROOT_FOLDER_ID ? ROOT_FOLDER_ID : new mongoDBCore.BSON.ObjectId(isValidId(parentId) ? parentId : NULL_ID) } },
        { $sort: { _id: -1 } },
        { $skip: page * MAX_FILES_PER_PAGE },
        { $limit: MAX_FILES_PER_PAGE },
        {
          $project: {
            _id: 0,
            id: '$_id',
            userId: '$userId',
            name: '$name',
            type: '$type',
            isPublic: '$isPublic',
            parentId: { $cond: { if: { $eq: ['$parentId', ROOT_FOLDER_ID] }, then: 0, else: '$parentId' } },
          },
        },
      ]).toArray();

    res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const { user } = req;
    const { id } = req.params;
    const userId = user._id.toString();
    const fileFilter = { _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID), userId: new mongoDBCore.BSON.ObjectId(userId) };

    const file = await (await dbClient.filesCollection()).findOne(fileFilter);
    if (!file) return sendErrorResponse(res, 404, 'Not found');

    await (await dbClient.filesCollection()).updateOne(fileFilter, { $set: { isPublic: true } });

    res.status(200).json({
      id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId === ROOT_FOLDER_ID ? 0 : file.parentId.toString(),
    });
  }

  static async putUnpublish(req, res) {
    const { user } = req;
    const { id } = req.params;
    const userId = user._id.toString();
    const fileFilter = { _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID), userId: new mongoDBCore.BSON.ObjectId(userId) };

    const file = await (await dbClient.filesCollection()).findOne(fileFilter);
    if (!file) return sendErrorResponse(res, 404, 'Not found');

    await (await dbClient.filesCollection()).updateOne(fileFilter, { $set: { isPublic: false } });

    res.status(200).json({
      id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId === ROOT_FOLDER_ID ? 0 : file.parentId.toString(),
    });
  }

  static async getFile(req, res) {
    const user = await getUserFromXToken(req);
    const { id } = req.params;
    const size = req.query.size || null;
    const userId = user ? user._id.toString() : '';
    const file = await (await dbClient.filesCollection())
      .findOne({ _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID) });

    if (!file || (!file.isPublic && file.userId.toString() !== userId)) return sendErrorResponse(res, 404, 'Not found');
    if (file.type === VALID_FILE_TYPES.folder) return sendErrorResponse(res, 400, 'A folder doesn\'t have content');

    let filePath = size ? `${file.localPath}_${size}` : file.localPath;
    if (!existsSync(filePath) || !(await statAsync(filePath)).isFile()) return sendErrorResponse(res, 404, 'Not found');

    res.setHeader('Content-Type', contentType(file.name) || 'text/plain; charset=utf-8');
    res.status(200).sendFile(await realpathAsync(filePath));
  }
}