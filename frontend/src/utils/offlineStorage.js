import Dexie from 'dexie';

const db = new Dexie('EduntraDB');

db.version(1).stores({
  chatMessages: '++id, session_id, timestamp',
  learningProgress: '++id, path_id, progress',
  syncQueue: '++id, type, timestamp'
});

export const saveChatOffline = async (message) => {
  try {
    await db.chatMessages.add(message);
  } catch (error) {
    console.error('Failed to save chat offline:', error);
  }
};

export const saveProgressOffline = async (pathId, progress) => {
  try {
    await db.learningProgress.add({ path_id: pathId, progress, timestamp: new Date() });
    await db.syncQueue.add({ type: 'progress', data: { path_id: pathId, progress }, timestamp: new Date() });
  } catch (error) {
    console.error('Failed to save progress offline:', error);
  }
};

export const getSyncQueue = async () => {
  try {
    return await db.syncQueue.toArray();
  } catch (error) {
    console.error('Failed to get sync queue:', error);
    return [];
  }
};

export const clearSyncQueue = async () => {
  try {
    await db.syncQueue.clear();
  } catch (error) {
    console.error('Failed to clear sync queue:', error);
  }
};

export default db;