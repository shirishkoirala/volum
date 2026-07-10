// Public API surface — re-exports all domain modules.
// Import from '../api/client' to access all types and functions.

export { shareUrl } from './client-base';

export type { Session, AvatarState, UserInfo } from './client-auth';
export {
  getSession,
  profileAvatarUrl,
  uploadProfileAvatar,
  deleteProfileAvatar,
  login,
  logout,
  setup,
  listUsers,
  createUser,
  deleteUser,
  changePassword,
  changeRole,
  revokeUserSessions,
} from './client-auth';

export type {
  BlockDevice,
  DevicesResponse,
  RootEntry,
  RootResponse,
  FileEntry,
  FileResponse,
  TrashEntry,
  TrashResponse,
  SearchResult,
  SearchResponse,
  DiskUsageNode,
  StatusResponse,
  UploadChunkResponse,
} from './client-files';
export {
  getRoots,
  getDevices,
  getFiles,
  getTrash,
  createFolder,
  createFile,
  renamePath,
  chmodPath,
  deletePath,
  restoreTrash,
  deleteTrash,
  downloadUrl,
  rawUrl,
  analyzeDiskUsage,
  searchFiles,
  batchRename,
  getStatus,
  getUploadStatus,
  UploadCancelledError,
  UploadPausedError,
  uploadChunk,
} from './client-files';

export type {
  JobType,
  JobStatus,
  ConflictItem,
  ConflictPolicy,
  Job,
  JobsResponse,
} from './client-jobs';
export {
  getJobs,
  createJob,
  cancelJob,
  retryJob,
  retryJobItem,
  pauseJob,
  resumeJob,
  clearCompletedJobs,
  clearFailedJobs,
  getJobConflicts,
  resolveJobConflicts,
} from './client-jobs';

export type { Share, CreateShareRequest } from './client-shares';
export { createShare, getShares, deleteShare } from './client-shares';

export type { ServiceInfo, ServiceHealthInfo } from './client-services';
export {
  listFavorites,
  addFavorite,
  removeFavorite,
  reorderFavorites,
  listServices,
  listServiceHealth,
  createService,
  updateService,
  deleteService,
  reorderServices,
  dbVacuum,
  pruneTable,
} from './client-services';
