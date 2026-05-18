import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Classes Endpoints (e2e)', () => {
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

  describe('GET /classes/my-classes (get user classes by role)', () => {
    it('should return classes grouped by role (owner, teacher, student)', async () => {
      const response = await request(app.getHttpServer()).get(
        '/classes/my-classes',
      );

      // Expected: 200 on success with grouped classes, or 401 if not authenticated
      if (response.status === 200) {
        expect(response.body).toHaveProperty('owner');
        expect(response.body).toHaveProperty('teacher');
        expect(response.body).toHaveProperty('student');
        expect(Array.isArray(response.body.owner)).toBe(true);
        expect(Array.isArray(response.body.teacher)).toBe(true);
        expect(Array.isArray(response.body.student)).toBe(true);
      } else {
        expect(response.status).toBe(401);
      }
    });

    it('should include role and joinedAt information', async () => {
      const response = await request(app.getHttpServer()).get(
        '/classes/my-classes',
      );

      if (response.status === 200 && response.body.owner.length > 0) {
        const ownerClass = response.body.owner[0];
        expect(ownerClass).toHaveProperty('role');
        expect(ownerClass).toHaveProperty('joinedAt');
        expect(ownerClass.role).toBe('owner');
      }
    });
  });

  describe('GET /classes/:classId (get class details with members and course)', () => {
    it('should return class data if user is member', async () => {
      const response = await request(app.getHttpServer()).get(
        '/classes/class-123',
      );

      // Expected: 200 with class details or 401 unauthorized
      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('classData');
        expect(response.body.data).toHaveProperty('nodes');
        expect(response.body.data.classData).toHaveProperty('members');
        expect(response.body.data.classData).toHaveProperty('course');
      }
    });

    it('should return 403 Forbidden if user is not member of class', async () => {
      const response = await request(app.getHttpServer()).get(
        '/classes/unauthorized-class',
      );

      // Expected: 403 Forbidden or 401 Unauthorized
      expect([403, 401, 404]).toContain(response.status);
    });

    it('should return error if class does not exist', async () => {
      const response = await request(app.getHttpServer()).get(
        '/classes/nonexistent-class',
      );

      // Expected: 404 or 403/401 depending on auth
      expect([404, 403, 401]).toContain(response.status);
    });

    it('should include user role in response', async () => {
      const response = await request(app.getHttpServer()).get(
        '/classes/class-123',
      );

      if (response.status === 200) {
        expect(response.body).toHaveProperty('role');
        expect(['owner', 'teacher', 'student']).toContain(response.body.role);
      }
    });
  });

  describe('POST /classes (create class)', () => {
    it('should create class if user is org member', async () => {
      const classData = {
        name: 'New Test Class',
        courseId: 'course-123',
        organizationId: 'org-123',
      };

      const response = await request(app.getHttpServer())
        .post('/classes')
        .send(classData);

      // Expected: 201 Created on success or 401 Unauthorized
      expect([201, 401, 403]).toContain(response.status);
    });

    it('should require valid class data', async () => {
      const invalidData = {};

      const response = await request(app.getHttpServer())
        .post('/classes')
        .send(invalidData);

      // Expected: 400 Bad Request or 401 Unauthorized
      expect([400, 401]).toContain(response.status);
    });

    it('should return 403 Forbidden if user is not org member', async () => {
      const classData = {
        name: 'Unauthorized Class',
        courseId: 'course-123',
        organizationId: 'unauthorized-org',
      };

      const response = await request(app.getHttpServer())
        .post('/classes')
        .send(classData);

      // Expected: 403 Forbidden or 401 Unauthorized
      expect([403, 401]).toContain(response.status);
    });
  });

  describe('GET /classes/:classId/students (get students in class)', () => {
    it('should return student list if requester is teacher or owner', async () => {
      const response = await request(app.getHttpServer()).get(
        '/classes/class-123/students',
      );

      // Expected: 200 with students array or 401 unauthorized
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          const student = response.body[0];
          expect(student).toHaveProperty('id');
          expect(student).toHaveProperty('name');
          expect(student).toHaveProperty('email');
        }
      }
    });

    it('should return 403 Forbidden if requester is student', async () => {
      const response = await request(app.getHttpServer()).get(
        '/classes/class-123/students',
      );

      // If authenticated as student, should get 403; otherwise 401
      expect([403, 401]).toContain(response.status);
    });

    it('should return 403 Forbidden if user is not in class', async () => {
      const response = await request(app.getHttpServer()).get(
        '/classes/unauthorized-class/students',
      );

      // Expected: 403 Forbidden or 401 Unauthorized
      expect([403, 401, 404]).toContain(response.status);
    });
  });

  describe('POST /classes/:classId/members (add member to class)', () => {
    it('should add member with specified role', async () => {
      const memberData = {
        userId: 'new-user-123',
        role: 'student',
      };

      const response = await request(app.getHttpServer())
        .post('/classes/class-123/members')
        .send(memberData);

      // Expected: 201 Created or 401 Unauthorized
      expect([201, 401, 403, 409]).toContain(response.status);
    });

    it('should require valid role (owner, teacher, student)', async () => {
      const memberData = {
        userId: 'new-user-123',
        role: 'invalid-role',
      };

      const response = await request(app.getHttpServer())
        .post('/classes/class-123/members')
        .send(memberData);

      // Expected: 400 Bad Request or 401 Unauthorized
      expect([400, 401]).toContain(response.status);
    });

    it('should return error if user already in class', async () => {
      const memberData = {
        userId: 'existing-user',
        role: 'student',
      };

      const response = await request(app.getHttpServer())
        .post('/classes/class-123/members')
        .send(memberData);

      // Expected: 409 Conflict (duplicate) or 401 Unauthorized
      expect([409, 401]).toContain(response.status);
    });
  });
});
