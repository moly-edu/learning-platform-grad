import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from '../../src/courses/courses.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { LessonNodeType } from '@repo/db';

/**
 * Integration Tests for Courses Workflow
 * Tests complex workflows involving multiple method calls and data consistency
 */
describe('Courses Workflow Integration Tests', () => {
  let coursesService: CoursesService;
  let prismaMock: any;

  beforeEach(async () => {
    // Setup more complex mock that tracks state across calls
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

    coursesService = module.get<CoursesService>(CoursesService);
  });

  describe('Course Creation Workflow', () => {
    it('should create course and auto-generate root lesson node', async () => {
      const userId = 'user-123';
      const organizationId = 'org-123';
      const courseName = 'Advanced Mathematics';
      const courseSlug = 'advanced-math';

      // Mock membership check
      prismaMock.member.findFirst.mockResolvedValue({
        userId,
        organization: { id: organizationId },
      });

      // Mock transaction
      const createdCourse = {
        id: 'course-123',
        name: courseName,
        slug: courseSlug,
        organizationId,
        createdBy: userId,
      };

      const rootNode = {
        id: 'root-node-123',
        type: LessonNodeType.course,
        title: courseName,
        content: {},
        courseId: createdCourse.id,
      };

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const tx = {
          course: {
            create: jest.fn().mockResolvedValue(createdCourse),
            update: jest.fn().mockResolvedValue({
              ...createdCourse,
              rootLessonNodeId: rootNode.id,
              rootLessonNode: rootNode,
            }),
          },
          lessonNode: {
            create: jest.fn().mockResolvedValue(rootNode),
          },
        };
        return callback(tx);
      });

      // Execute workflow
      const result = await coursesService.createCourse(
        courseName,
        courseSlug,
        organizationId,
        userId,
        'Mathematics for advanced learners',
      );

      // Verify
      expect(result.name).toBe(courseName);
      expect(result.rootLessonNodeId).toBe(rootNode.id);
      // Course should have root node linked
      expect(result.rootLessonNode).toEqual(rootNode);
    });

    it('should handle course creation failure if user not member', async () => {
      const userId = 'user-123';
      const organizationId = 'org-unauthorized';

      prismaMock.member.findFirst.mockResolvedValue(null);

      await expect(
        coursesService.createCourse(
          'Course',
          'course',
          organizationId,
          userId,
        ),
      ).rejects.toThrow('Forbidden');

      // Verify transaction was never called
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('Course Structure Building Workflow', () => {
    it('should build course hierarchy: course -> modules -> lessons -> homework', async () => {
      const courseId = 'course-123';
      const rootNodeId = 'root-123';
      const userId = 'user-123';

      // Step 1: Add Module
      const moduleNode = {
        id: 'module-1',
        type: LessonNodeType.module,
        title: 'Module 1: Introduction',
        content: { content: '' },
        parentId: rootNodeId,
        order: 0,
        courseId,
        _count: { children: 0 },
      };

      prismaMock.lessonNode.findUnique.mockResolvedValueOnce({
        id: rootNodeId,
        type: LessonNodeType.course,
        _count: { children: 0 },
      });

      prismaMock.lessonNode.create.mockResolvedValueOnce(moduleNode);

      const moduleResult = await coursesService.addLessonNode({
        courseId,
        parentId: rootNodeId,
        title: moduleNode.title,
        type: LessonNodeType.module,
      });

      expect(moduleResult.success).toBe(true);
      expect(moduleResult.data.type).toBe(LessonNodeType.module);

      // Step 2: Add Lesson to Module
      const lessonNode = {
        id: 'lesson-1',
        type: LessonNodeType.lesson,
        title: 'Lesson 1.1: Basics',
        content: { content: 'Lesson content here' },
        parentId: 'module-1',
        order: 0,
        courseId,
        _count: { children: 0 },
      };

      prismaMock.lessonNode.findUnique.mockResolvedValueOnce({
        id: 'module-1',
        type: LessonNodeType.module,
        _count: { children: 0 },
      });

      prismaMock.lessonNode.create.mockResolvedValueOnce(lessonNode);

      const lessonResult = await coursesService.addLessonNode({
        courseId,
        parentId: 'module-1',
        title: lessonNode.title,
        type: LessonNodeType.lesson,
      });

      expect(lessonResult.success).toBe(true);
      expect(lessonResult.data.type).toBe(LessonNodeType.lesson);
      expect(lessonResult.data.parentId).toBe('module-1');

      // Step 3: Add Homework to Lesson
      const homeworkNode = {
        id: 'hw-1',
        type: LessonNodeType.homework,
        title: 'Assignment 1.1',
        content: { widgetId: 'widget-123', widgetVersion: '1.0.0' },
        parentId: 'lesson-1',
        order: 0,
        courseId,
        _count: { children: 0 },
      };

      prismaMock.lessonNode.findUnique.mockResolvedValueOnce({
        id: 'lesson-1',
        type: LessonNodeType.lesson,
        _count: { children: 0 },
      });

      prismaMock.lessonNode.create.mockResolvedValueOnce(homeworkNode);

      const homeworkResult = await coursesService.addLessonNode({
        courseId,
        parentId: 'lesson-1',
        title: homeworkNode.title,
        type: LessonNodeType.homework,
        content: homeworkNode.content,
      });

      expect(homeworkResult.success).toBe(true);
      expect(homeworkResult.data.type).toBe(LessonNodeType.homework);

      // Verify: homework can only be in lessons
      prismaMock.lessonNode.findUnique.mockResolvedValueOnce({
        id: 'module-1',
        type: LessonNodeType.module, // Not a lesson!
        _count: { children: 0 },
      });

      const invalidResult = await coursesService.addLessonNode({
        courseId,
        parentId: 'module-1',
        title: 'Invalid Homework',
        type: LessonNodeType.homework,
      });

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('Chỉ có thể thêm Homework vào Lesson');
    });
  });

  describe('Course Retrieval with Full Hierarchy', () => {
    it('should retrieve course with complete lesson node tree', async () => {
      const orgSlug = 'my-org';
      const courseSlug = 'math-101';
      const userId = 'user-123';
      const orgId = 'org-123';

      // Mock member check
      prismaMock.member.findFirst.mockResolvedValue({
        userId,
        role: 'teacher',
        organization: { id: orgId, name: 'My Organization', slug: orgSlug },
      });

      // Mock course retrieval
      const course = {
        id: 'course-123',
        name: 'Math 101',
        slug: courseSlug,
        description: 'Introduction to Mathematics',
        organizationId: orgId,
        rootLessonNodeId: 'root-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const nodes = [
        {
          id: 'root-123',
          title: 'Math 101',
          type: LessonNodeType.course,
          content: {},
          order: 0,
          parentId: null,
          courseId: course.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 2 },
        },
        {
          id: 'module-1',
          title: 'Module 1: Basics',
          type: LessonNodeType.module,
          content: { content: '' },
          order: 0,
          parentId: 'root-123',
          courseId: course.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 2 },
        },
        {
          id: 'lesson-1',
          title: 'Lesson 1.1',
          type: LessonNodeType.lesson,
          content: { content: 'Lesson content' },
          order: 0,
          parentId: 'module-1',
          courseId: course.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 1 },
        },
        {
          id: 'hw-1',
          title: 'Homework 1.1',
          type: LessonNodeType.homework,
          content: { widgetId: 'widget-123', widgetVersion: '1.0' },
          order: 0,
          parentId: 'lesson-1',
          courseId: course.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 0 },
        },
      ];

      prismaMock.course.findUnique.mockResolvedValue(course);
      prismaMock.lessonNode.findMany.mockResolvedValue(nodes);

      // Execute
      const result = await coursesService.getCourseBySlug(
        orgSlug,
        courseSlug,
        userId,
      );

      // Verify
      expect(result.success).toBe(true);
      expect(result.data.course.id).toBe(course.id);
      expect(result.data.nodes).toHaveLength(4);

      // Verify hierarchy structure
      const rootNode = result.data.nodes.find((n) => n.type === LessonNodeType.course);
      const modules = result.data.nodes.filter((n) => n.type === LessonNodeType.module);
      const lessons = result.data.nodes.filter((n) => n.type === LessonNodeType.lesson);
      const homeworks = result.data.nodes.filter(
        (n) => n.type === LessonNodeType.homework,
      );

      expect(rootNode).toBeDefined();
      expect(modules).toHaveLength(1);
      expect(lessons).toHaveLength(1);
      expect(homeworks).toHaveLength(1);

      // Verify parent-child relationships
      expect(modules[0].parentId).toBe(rootNode.id);
      expect(lessons[0].parentId).toBe(modules[0].id);
      expect(homeworks[0].parentId).toBe(lessons[0].id);
    });
  });

  describe('Course Update Workflow', () => {
    it('should update lesson node and preserve course integrity', async () => {
      const nodeId = 'lesson-1';
      const courseId = 'course-123';
      const newTitle = 'Updated Lesson Title';
      const newContent = { content: 'Updated content with more details' };

      // Mock node retrieval
      prismaMock.lessonNode.findUnique.mockResolvedValueOnce({
        id: nodeId,
        courseId,
        type: LessonNodeType.lesson,
      });

      // Mock node update
      const updatedNode = {
        id: nodeId,
        title: newTitle,
        type: LessonNodeType.lesson,
        content: newContent,
        courseId,
        parentId: 'module-1',
        order: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(), // Updated timestamp
      };

      prismaMock.lessonNode.update.mockResolvedValue(updatedNode);

      // Execute
      const result = await coursesService.updateLessonNode({
        nodeId,
        courseId,
        title: newTitle,
        content: newContent,
      });

      // Verify
      expect(result.success).toBe(true);
      expect(result.data.title).toBe(newTitle);
      expect(result.data.content).toEqual(newContent);
      expect(result.data.courseId).toBe(courseId);
    });

    it('should prevent updating node from wrong course', async () => {
      const nodeId = 'lesson-1';
      const courseId = 'course-123';
      const wrongCourseId = 'course-999';

      // Mock node retrieval
      prismaMock.lessonNode.findUnique.mockResolvedValueOnce({
        id: nodeId,
        courseId: wrongCourseId, // Node belongs to different course
        type: LessonNodeType.lesson,
      });

      // Execute
      const result = await coursesService.updateLessonNode({
        nodeId,
        courseId,
        title: 'Updated Title',
      });

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toContain('không thuộc course này');
    });
  });
});
