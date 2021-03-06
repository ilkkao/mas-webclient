//
//   Copyright 2014 Ilkka Oksanen <iao@iki.fi>
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing,
//   software distributed under the License is distributed on an "AS
//   IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
//   express or implied.  See the License for the specific language
//   governing permissions and limitations under the License.
//

const spawn = require('child_process').spawn;
const path = require('path');
const fs = require('fs');
const uuid = require('uid2');
const conf = require('../lib/conf');
const log = require('../lib/log');

let dataDirectory = path.normalize(conf.get('files:upload_directory'));

// TODO: move this to library.
if (dataDirectory.charAt(0) !== path.sep) {
  dataDirectory = path.join(conf.root(), dataDirectory);
}

module.exports = async function handle(ctx) {
  const user = ctx.mas.user;

  if (!user || !ctx.request.files || !ctx.request.files.file) {
    ctx.status = 400;
    return;
  }

  try {
    const url = await upload(user, ctx.request.files.file);

    ctx.status = 200;
    ctx.body = { url: [url] };

    log.info(user, `Successful upload: ${url}`);
  } catch (e) {
    ctx.status = e === 'E_TOO_LARGE' ? 413 : 400;

    log.warn(user, `Upload failed: ${e}`);
  }
};

async function upload(user, fileObject) {
  const fileName = fileObject.name;
  const filePath = fileObject.path;
  const extension = path.extname(fileName);

  const fileUUID = uuid(20);
  const hashDirectory = fileUUID.substring(0, 2);

  const targetDirectory = path.join(dataDirectory, hashDirectory);

  if (fileObject.size > 10000000) {
    // 10MB
    throw new Error('E_TOO_LARGE');
  }

  if (conf.get('files:autorotate_jpegs')) {
    await autoRotateJPEGFile(filePath, extension);
  }

  fs.mkdirSync(targetDirectory, { recursive: true });
  await copy(filePath, path.join(targetDirectory, fileUUID + extension));
  await writeMetaDataFile(path.join(targetDirectory, `${fileUUID}.json`), fileName, user.id);

  return `${conf.getComputed('site_url')}/files/${fileUUID}/${encodeURIComponent(fileName)}`;
}

function autoRotateJPEGFile(fileName, extension) {
  if (extension.match(/\.(jpeg|jpg)$/i) === null) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const exiftrans = spawn('exiftran', ['-ai', fileName]);

    exiftrans.on('error', err => {
      reject(err);
    });

    exiftrans.on('close', code => {
      if (code !== 0) {
        log.warn(`JPG exiftrans autorotate failed, exit code: ${code}, file: ${fileName}`);
      }

      resolve();
    });
  });
}

function copy(srcFilePath, targetFilePath) {
  return new Promise((resolve, reject) => {
    const rd = fs.createReadStream(srcFilePath);
    const wr = fs.createWriteStream(targetFilePath);

    const rejectCleanup = err => {
      rd.destroy();
      wr.end();
      reject(err);
    };

    rd.on('error', rejectCleanup);
    wr.on('error', rejectCleanup);
    wr.on('finish', resolve);

    rd.pipe(wr);
  });
}

function writeMetaDataFile(filePath, originalFileName, userId) {
  const metaData = {
    userId,
    originalFileName,
    ts: Math.round(Date.now() / 1000)
  };

  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, JSON.stringify(metaData), err => {
      if (err) {
        reject(new Error('File upload metadata file write error'));
      } else {
        resolve();
      }
    });
  });
}
