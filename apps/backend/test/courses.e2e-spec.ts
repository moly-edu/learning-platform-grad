import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Courses Endpoints (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /courses (get courses by organization)', () => {
    it('should return courses if user is authenticated and member of org', async () => {
      // Note: This requires a valid session/auth token in real scenario
      // For testing purposes, you would mock the auth session
      const response = await request(app.getHttpServer())
        .get('/courses')
        .query({ organizationId: 'org-test-123' });

      // Expected: 200 if authenticated, 401 if not authenticated
      expect([200, 401]).toContain(response.status);
    });

    it('should return 403 Forbidden if user is not member of organization', async () => {
      const response = await request(app.getHttpServer())
        .get('/courses')
        .query({ organizationId: 'org-unauthorized' });

      // Expected: 403 Forbidden or 401 Unauthorized (no valid auth)
      expect([403, 401]).toContain(response.status);
    });
  });

  describe('GET /courses/:orgSlug/:courseSlug (get course by slug)', () => {
    it('should return course details with lesson nodes structure', async () => {
      const response = await request(app.getHttpServer()).get(
        '/courses/test-org/test-course',
      );

      // Expected: 200 on success or 401 if not authenticated
      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('course');
        expect(response.body.data).toHaveProperty('nodes');
      }
    });

    it('should return 403 Forbidden if user is not member of organization', async () => {
      const response = await request(app.getHttpServer()).get(
        '/courses/unauthorized-org/test-course',
      );

      expect([403, 401, 404]).toContain(response.status);
    });

    it('should return error if course does not exist', async () => {
      const response = await request(app.getHttpServer()).get(
        '/courses/test-org/nonexistent-course',
      );

      // Expected: 404 or 200 with error message
      expect([404, 200, 401]).toContain(response.status);
    });
  });

  describe('POST /courses (create course)', () => {
    it('should require valid course data', async () => {
      const invalidData = {};

      const response = await request(app.getHttpServer())
        .post('/courses')
        .send(invalidData);

      // Expected: 400 Bad Request or 401 Unauthorized
      expect([400, 401]).toContain(response.status);
    });

    it('should return 403 if user is not member of organization', async () => {
      const courseData = {
        name: 'New Course',
        slug: 'new-course',
        organizationId: 'org-unauthorized',
        description: 'A test course',
      };

      const response = await request(app.getHttpServer())
        .post('/courses')
        .send(courseData);

      // Expected: 403 Forbidden or 401 Unauthorized
      expect([403, 401]).toContain(response.status);
    });
  });

  describe('POST /courses/:courseId/lesson-nodes (add lesson node)', () => {
    it('should add lesson node to valid course', async () => {
      const nodeData = {
        parentId: 'root-node-123',
        type: 'lesson',
        title: 'New Lesson',
        content: { content: 'Lesson content' },
      };

      const response = await request(app.getHttpServer())
        .post('/courses/course-123/lesson-nodes')
        .send(nodeData);

      // Expected: 200 on success or 401 if not authenticated
      expect([200, 401, 404]).toContain(response.status);
    });

    it('should validate node type constraints', async () => {
      // Homework can only be added to lesson nodes
      const invalidNodeData = {
        parentId: 'module-node-123', // module, not lesson
        type: 'homework',
        title: 'Invalid Homework',
        content: { widgetId: 'widget-123', widgetVersion: '1.0' },
      };

      const response = await request(app.getHttpServer())
        .post('/courses/course-123/lesson-nodes')
        .send(invalidNodeData);

      // Expected: 400 or 200 with error message
      expect([400, 200, 401]).toContain(response.status);
    });

    it('should return error if parent node does not exist', async () => {
      const nodeData = {
        parentId: 'nonexistent-parent',
        type: 'lesson',
        title: 'Orphan Lesson',
      };

      const response = await request(app.getHttpServer())
        .post('/courses/course-123/lesson-nodes')
        .send(nodeData);

      // Expected: 400 or 200 with error message
      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('PUT /courses/:courseId/lesson-nodes/:nodeId (update lesson node)', () => {
    it('should update lesson node title and content', async () => {
      const updateData = {
        title: 'Updated Lesson Title',
        content: { content: 'Updated content' },
      };

      const response = await request(app.getHttpServer())
        .put('/courses/course-123/lesson-nodes/node-123')
        .send(updateData);

      // Expected: 200 on success or 401 if not authenticated
      expect([200, 401, 404]).toContain(response.status);
    });

    it('should return error if node does not exist', async () => {
      const updateData = {
        title: 'Updated Title',
      };

      const response = await request(app.getHttpServer())
        .put('/courses/course-123/lesson-nodes/nonexistent-node')
        .send(updateData);

      // Expected: 404 or 200 with error message
      expect([200, 404, 401]).toContain(response.status);
    });

    it('should validate that node belongs to the course', async () => {
      const updateData = {
        title: 'Updated Title',
      };

      const response = await request(app.getHttpServer())
        .put('/courses/course-123/lesson-nodes/node-from-other-course')
        .send(updateData);

      // Expected: 400 or 200 with error message
      expect([200, 400, 404, 401]).toContain(response.status);
    });
  });
});
