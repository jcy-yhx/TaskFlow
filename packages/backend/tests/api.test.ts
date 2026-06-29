import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Express } from 'express';

describe('API Integration', () => {
  let app: Express;
  let accessToken: string;
  let workspaceId: string;
  let projectId: string;

  beforeAll(async () => {
    app = createApp();

    // Register a fresh user
    const email = `api-test-${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'testpass123', name: 'API Tester' })
      .expect(201);

    accessToken = res.body.data.accessToken;

    // Create workspace
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Test Workspace' })
      .expect(201);

    workspaceId = wsRes.body.data.id;
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/users/me returns current user', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.email).toContain('api-test-');
    expect(res.body.data.name).toBe('API Tester');
  });

  it('GET /api/workspaces returns list', async () => {
    const res = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('full CRUD flow: project + task', async () => {
    // Create project
    const projRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'CRUD Test', color: '#22c55e' })
      .expect(201);

    projectId = projRes.body.data.id;

    // Create task
    const taskRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Integration test task', status: 'TODO' })
      .expect(201);

    const taskId = taskRes.body.data.id;
    expect(taskRes.body.data.title).toBe('Integration test task');

    // Update task
    const updRes = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Updated task' })
      .expect(200);

    expect(updRes.body.data.title).toBe('Updated task');

    // Move task
    await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'IN_PROGRESS', position: 0 })
      .expect(200);

    // Get by status
    const byStatusRes = await request(app)
      .get(`/api/projects/${projectId}/tasks/by-status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(byStatusRes.body.data.IN_PROGRESS.length).toBe(1);
    expect(byStatusRes.body.data.TODO.length).toBe(0);

    // Delete task
    await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Delete project
    await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('rejects unauthenticated requests', async () => {
    await request(app).get('/api/users/me').expect(401);
  });

  it('rejects malformed JWT', async () => {
    await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .expect(401);
  });
});
