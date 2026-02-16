import path from 'path';

function getDataRoot() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.env.VERCEL) return path.join('/tmp', 'newidea-data');
  return path.join(process.cwd(), '.data');
}

export function getCasesFilePath() {
  return path.join(getDataRoot(), 'cases.json');
}

export function getUploadsDirPath() {
  return path.join(getDataRoot(), 'uploads');
}
