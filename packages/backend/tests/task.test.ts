import { describe, it, expect } from 'vitest';
import { createTask, getTask, updateTask, deleteTask, getTasksByStatus, updateTaskStatus } from '../src/services/task.service.js';

describe('Task Service', () => {
  let projectId = 'test-project-noex'; // A non-existent project — tests validate error handling

  it('should throw NotFoundError for non-existent task', async () => {
    await expect(getTask('non-existent-id')).rejects.toThrow(/not found/i);
  });

  it('should throw NotFoundError when updating non-existent task', async () => {
    await expect(updateTask('non-existent-id', { title: 'x' })).rejects.toThrow(/not found/i);
  });

  it('should throw NotFoundError when deleting non-existent task', async () => {
    await expect(deleteTask('non-existent-id')).rejects.toThrow(/not found/i);
  });

  it('should throw NotFoundError when moving non-existent task', async () => {
    await expect(
      updateTaskStatus('non-existent-id', { status: 'DONE', position: 0 })
    ).rejects.toThrow(/not found/i);
  });
});
