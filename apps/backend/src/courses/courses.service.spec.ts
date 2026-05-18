import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from './courses.service';
import { PrismaService } from '../prisma/prisma.service';
import { LessonNodeType } from '@repo/db';

describe('CoursesService', () => {
  let service: CoursesService;
  let prismaMock: any;

  beforeEach(async () => {
    // Mock Prisma
    prismaMock = {
      member: {
        findFirst: jest.fn(),
      },
      course: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      lessonNode: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCourses', () => {
    it('should return courses if user is a member of organization', async () => {
      const organizationId = 'org-123';
      const userId = 'user-123';
      const courses = [
        { id: 'course-1', name: 'Course 1' },
        { id: 'course-2', name: 'Course 2' },
      ];

      prismaMock.member.findFirst.mockResolvedValue({
        userId,
        organization: { id: organizationId },
      });

      prismaMock.course.findMany.mockResolvedValue(courses);

      const result = await service.getCourses(organizationId, userId);

      expect(result).toEqual(courses);
      expect(prismaMock.member.findFirst).toHaveBeenCalledWith({
        where: { userId, organization: { id: organizationId } },
      });
      expect(prismaMock.course.findMany).toHaveBeenCalledWith({
        where: { organizationId },
      });
    });

    it('should throw Forbidden error if user is not a member', async () => {
      const organizationId = 'org-123';
      const userId = 'user-123';

      prismaMock.member.findFirst.mockResolvedValue(null);

      await expect(
        service.getCourses(organizationId, userId),
      ).rejects.toThrow('Forbidden');
    });
  });

  describe('getCourseBySlug', () => {
    it('should return course with nodes if user is a member', async () => {
      const orgSlug = 'my-org';
      const courseSlug = 'math-101';
      const userId = 'user-123';
      const orgId = 'org-123';

      prismaMock.member.findFirst.mockResolvedValue({
        userId,
        role: 'teacher',
        organization: { id: orgId, name: 'My Org', slug: orgSlug },
      });

      const course = {
        id: 'course-123',
        name: 'Math 101',
        slug: courseSlug,
        description: 'Basic Math',
        organizationId: orgId,
        rootLessonNodeId: 'root-node-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const nodes = [
        {
          id: 'node-1',
          title: 'Lesson 1',
          type: LessonNodeType.lesson,
          content: { content: '' },
          order: 0,
          parentId: 'root-node-1',
          courseId: 'course-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 1 },
        },
      ];

      prismaMock.course.findUnique.mockResolvedValue(course);
      prismaMock.lessonNode.findMany.mockResolvedValue(nodes);

      const result = await service.getCourseBySlug(orgSlug, courseSlug, userId);

      expect(result.success).toBe(true);
      expect(result.data.course).toEqual(course);
      expect(result.data.nodes).toEqual(nodes);
      expect(result.role).toBe('teacher');
    });

    it('should return error if course not found', async () => {
      const orgSlug = 'my-org';
      const courseSlug = 'nonexistent';
      const userId = 'user-123';
      const orgId = 'org-123';

      prismaMock.member.findFirst.mockResolvedValue({
        userId,
        role: 'student',
        organization: { id: orgId, name: 'My Org', slug: orgSlug },
      });

      prismaMock.course.findUnique.mockResolvedValue(null);

      const result = await service.getCourseBySlug(orgSlug, courseSlug, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Course không tồn tại');
    });

    it('should throw Forbidden error if user is not a member', async () => {
      const orgSlug = 'my-org';
      const courseSlug = 'math-101';
      const userId = 'user-123';

      prismaMock.member.findFirst.mockResolvedValue(null);

      await expect(
        service.getCourseBySlug(orgSlug, courseSlug, userId),
      ).rejects.toThrow('Forbidden');
    });
  });

  describe('createCourse', () => {
    it('should create course with root lesson node if user is member', async () => {
      const userId = 'user-123';
      const organizationId = 'org-123';
      const name = 'New Course';
      const slug = 'new-course';
      const description = 'A new course';

      prismaMock.member.findFirst.mockResolvedValue({
        userId,
        role: 'teacher',
        organization: { id: organizationId },
      });

      const newCourse = {
        id: 'course-456',
        name,
        slug,
        description,
        organizationId,
        createdBy: userId,
      };

      const rootNode = {
        id: 'root-node-123',
        type: LessonNodeType.course,
        title: name,
        content: {},
        courseId: newCourse.id,
      };

      const updatedCourse = {
        ...newCourse,
        rootLessonNodeId: rootNode.id,
        rootLessonNode: rootNode,
      };

      prismaMock.$transaction.mockImplementation(async (callback) => {
        // Mock transaction
        const tx = {
          course: {
            create: jest.fn().mockResolvedValue(newCourse),
            update: jest.fn().mockResolvedValue(updatedCourse),
          },
          lessonNode: {
            create: jest.fn().mockResolvedValue(rootNode),
          },
        };
        return callback(tx);
      });

      const result = await service.createCourse(
        name,
        slug,
        organizationId,
        userId,
        description,
      );

      expect(result.rootLessonNodeId).toBe(rootNode.id);
      expect(result.name).toBe(name);
    });

    it('should throw Forbidden error if user is not a member', async () => {
      const userId = 'user-123';
      const organizationId = 'org-123';

      prismaMock.member.findFirst.mockResolvedValue(null);

      await expect(
        service.createCourse('Course', 'course', organizationId, userId),
      ).rejects.toThrow('Forbidden');
    });
  });

  describe('addLessonNode', () => {
    it('should add lesson node to existing parent node', async () => {
      const courseId = 'course-123';
      const parentId = 'parent-node-1';
      const title = 'New Lesson';
      const type = LessonNodeType.lesson;

      const parentNode = {
        id: parentId,
        type: LessonNodeType.module,
        _count: { children: 0 },
      };

      const newNode = {
        id: 'node-new',
        title,
        type,
        content: { content: '' },
        order: 0,
        parentId,
        courseId,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { children: 0 },
      };

      prismaMock.lessonNode.findUnique.mockResolvedValue(parentNode);
      prismaMock.lessonNode.create.mockResolvedValue(newNode);

      const result = await service.addLessonNode({
        courseId,
        parentId,
        title,
        type,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(newNode);
    });

    it('should return error if parent node not found', async () => {
      const courseId = 'course-123';
      const parentId = 'nonexistent';
      const title = 'New Lesson';
      const type = LessonNodeType.lesson;

      prismaMock.lessonNode.findUnique.mockResolvedValue(null);

      const result = await service.addLessonNode({
        courseId,
        parentId,
        title,
        type,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Parent node không tồn tại');
    });

    it('should validate homework can only be added to lesson nodes', async () => {
      const courseId = 'course-123';
      const parentId = 'parent-node-1';
      const title = 'New Homework';
      const type = LessonNodeType.homework;

      const parentNode = {
        id: parentId,
        type: LessonNodeType.module,
        _count: { children: 0 },
      };

      prismaMock.lessonNode.findUnique.mockResolvedValue(parentNode);

      const result = await service.addLessonNode({
        courseId,
        parentId,
        title,
        type,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Chỉ có thể thêm Homework vào Lesson');
    });
  });
});
