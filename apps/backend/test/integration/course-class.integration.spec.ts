import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from '../../src/courses/courses.service';
import { ClassesService } from '../../src/classes/classes.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ClassRole, LessonNodeType } from '@repo/db';

/**
 * Integration Tests for Course-Class Interaction Workflow
 * Tests complex workflows involving both CoursesService and ClassesService
 */
describe('Course-Class Interaction Integration Tests', () => {
  let coursesService: CoursesService;
  let classesService: ClassesService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      member: {
        findFirst: jest.fn(),
      },
      course: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      lessonNode: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      class: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      classMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        ClassesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    coursesService = module.get<CoursesService>(CoursesService);
    classesService = module.get<ClassesService>(ClassesService);
  });

  describe('Complete Learning Management Workflow', () => {
    it('should execute full workflow: create course -> populate -> create class -> assign students', async () => {
      const userId = 'teacher-123';
      const organizationId = 'org-123';
      const courseSlug = 'math-101';
      const courseName = 'Mathematics 101';

      // ===== PHASE 1: Create Course =====
      prismaMock.member.findFirst.mockResolvedValueOnce({
        userId,
        organization: { id: organizationId },
      });

      const course = {
        id: 'course-123',
        name: courseName,
        slug: courseSlug,
        organizationId,
        createdBy: userId,
      };

      const rootNode = {
        id: 'root-123',
        type: LessonNodeType.course,
        title: courseName,
        content: {},
        courseId: course.id,
      };

      prismaMock.$transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          course: {
            create: jest.fn().mockResolvedValue(course),
            update: jest.fn().mockResolvedValue({
              ...course,
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

      const createdCourse = await coursesService.createCourse(
        courseName,
        courseSlug,
        organizationId,
        userId,
        'Introduction to Mathematics',
      );

      expect(createdCourse.id).toBe('course-123');
      expect(createdCourse.rootLessonNodeId).toBe('root-123');

      // ===== PHASE 2: Populate Course Structure =====
      // Add Module
      prismaMock.lessonNode.findUnique.mockResolvedValueOnce({
        id: rootNode.id,
        type: LessonNodeType.course,
        _count: { children: 0 },
      });

      const moduleNode = {
        id: 'module-1',
        type: LessonNodeType.module,
        title: 'Module 1: Basics',
        content: { content: '' },
        parentId: rootNode.id,
        order: 0,
        courseId: course.id,
        _count: { children: 1 },
      };

      prismaMock.lessonNode.create.mockResolvedValueOnce(moduleNode);

      const addedModule = await coursesService.addLessonNode({
        courseId: course.id,
        parentId: rootNode.id,
        title: moduleNode.title,
        type: LessonNodeType.module,
      });

      expect(addedModule.success).toBe(true);
      expect(addedModule.data.type).toBe(LessonNodeType.module);

      // Add Lesson
      prismaMock.lessonNode.findUnique.mockResolvedValueOnce({
        id: 'module-1',
        type: LessonNodeType.module,
        _count: { children: 0 },
      });

      const lessonNode = {
        id: 'lesson-1',
        type: LessonNodeType.lesson,
        title: 'Lesson 1.1: Introduction',
        content: { content: 'Lesson content' },
        parentId: 'module-1',
        order: 0,
        courseId: course.id,
        _count: { children: 0 },
      };

      prismaMock.lessonNode.create.mockResolvedValueOnce(lessonNode);

      const addedLesson = await coursesService.addLessonNode({
        courseId: course.id,
        parentId: 'module-1',
        title: lessonNode.title,
        type: LessonNodeType.lesson,
      });

      expect(addedLesson.success).toBe(true);

      // ===== PHASE 3: Create Class from Course =====
      prismaMock.member.findFirst.mockResolvedValueOnce({
        userId,
      });

      const newClass = {
        id: 'class-123',
        name: 'Class 10A',
        courseId: course.id,
      };

      prismaMock.$transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          class: {
            create: jest.fn().mockResolvedValue(newClass),
          },
          classMember: {
            create: jest.fn().mockResolvedValue({
              classId: newClass.id,
              userId,
              role: ClassRole.owner,
            }),
          },
        };
        return callback(tx);
      });

      const createdClass = await classesService.createClass(
        newClass.name,
        course.id,
        organizationId,
        userId,
      );

      expect(createdClass.id).toBe('class-123');
      expect(createdClass.courseId).toBe(course.id);

      // ===== PHASE 4: Add Students to Class =====
      const students = [
        { id: 'student-1', name: 'Alice' },
        { id: 'student-2', name: 'Bob' },
        { id: 'student-3', name: 'Charlie' },
      ];

      for (const student of students) {
        prismaMock.classMember.create.mockResolvedValueOnce({
          classId: newClass.id,
          userId: student.id,
          role: ClassRole.student,
          joinedAt: new Date(),
        });

        const added = await classesService.addClassMember(
          newClass.id,
          student.id,
          ClassRole.student,
        );
        expect(added.role).toBe(ClassRole.student);
      }

      // Verify complete workflow
      expect(prismaMock.member.findFirst).toHaveBeenCalledTimes(2);
      expect(prismaMock.lessonNode.create).toHaveBeenCalledTimes(2); // Module + Lesson
      expect(prismaMock.classMember.create).toHaveBeenCalledTimes(3); // 3 students (owner added in transaction)
    });
  });

  describe('Course Assignment Workflow', () => {
    it('should create assignments in lesson and track assignments per student', async () => {
      const courseId = 'course-123';
      const classId = 'class-123';
      const lessonId = 'lesson-1';
      const studentId = 'student-1';

      // Step 1: Add homework/assignment to lesson
      prismaMock.lessonNode.findUnique.mockResolvedValueOnce({
        id: lessonId,
        type: LessonNodeType.lesson,
        _count: { children: 0 },
      });

      const assignment = {
        id: 'assignment-1',
        type: LessonNodeType.homework,
        title: 'Assignment 1.1: Problem Set',
        content: {
          widgetId: 'math-widget',
          widgetVersion: '1.0.0',
        },
        parentId: lessonId,
        order: 0,
        courseId,
        _count: { children: 0 },
      };

      prismaMock.lessonNode.create.mockResolvedValue(assignment);

      const createdAssignment = await coursesService.addLessonNode({
        courseId,
        parentId: lessonId,
        title: assignment.title,
        type: LessonNodeType.homework,
        content: assignment.content,
      });

      expect(createdAssignment.success).toBe(true);
      expect(createdAssignment.data.type).toBe(LessonNodeType.homework);

      // Step 2: Verify class structure includes the new assignment
      prismaMock.classMember.findUnique.mockResolvedValue({
        userId: studentId,
        role: ClassRole.student,
      });

      const classData = {
        id: classId,
        name: 'Class 10A',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [
          {
            userId: studentId,
            role: ClassRole.student,
            user: {
              id: studentId,
              name: 'Alice',
              email: 'alice@example.com',
              image: null,
            },
          },
        ],
        groups: [],
        course: {
          id: courseId,
          name: 'Mathematics 101',
          rootLessonNodeId: 'root-123',
          createdBy: 'teacher-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const courseNodes = [
        {
          id: 'root-123',
          title: 'Mathematics 101',
          type: 'course',
          content: {},
          order: 0,
          parentId: null,
          courseId,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 1 },
        },
        {
          id: 'module-1',
          title: 'Module 1',
          type: 'module',
          content: {},
          order: 0,
          parentId: 'root-123',
          courseId,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 1 },
        },
        {
          id: lessonId,
          title: 'Lesson 1.1',
          type: 'lesson',
          content: {},
          order: 0,
          parentId: 'module-1',
          courseId,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 1 },
        },
        assignment,
      ];

      prismaMock.class.findUnique.mockResolvedValue(classData);
      prismaMock.lessonNode.findMany.mockResolvedValue(courseNodes);

      const classDetails = await classesService.getClassWithCourse(
        classId,
        studentId,
      );

      expect(classDetails.success).toBe(true);
      expect(classDetails.data.nodes).toHaveLength(4);

      // Verify assignment is in course structure
      const assignments = classDetails.data.nodes.filter(
        (n) => n.type === LessonNodeType.homework,
      );
      expect(assignments).toHaveLength(1);
      expect(assignments[0].content.widgetId).toBe('math-widget');
    });
  });

  describe('Multi-Class Course Sharing Workflow', () => {
    it('should allow same course to be used by multiple classes independently', async () => {
      const courseId = 'course-shared';
      const courseSlug = 'science-101';
      const orgId = 'org-123';

      // Step 1: Verify course exists for both classes
      const sharedCourse = {
        id: courseId,
        name: 'Science 101',
        slug: courseSlug,
        organizationId: orgId,
        rootLessonNodeId: 'root-science',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const courseNodes = [
        {
          id: 'root-science',
          title: 'Science 101',
          type: LessonNodeType.course,
          content: {},
          order: 0,
          parentId: null,
          courseId,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 2 },
        },
        {
          id: 'unit-1',
          title: 'Unit 1: Physics',
          type: LessonNodeType.module,
          content: {},
          order: 0,
          parentId: 'root-science',
          courseId,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 0 },
        },
      ];

      // Setup for Class A
      prismaMock.member.findFirst.mockResolvedValueOnce({
        userId: 'teacher-a',
        role: 'teacher',
        organization: { id: orgId, name: 'School', slug: 'school' },
      });

      prismaMock.course.findUnique.mockResolvedValueOnce(sharedCourse);
      prismaMock.lessonNode.findMany.mockResolvedValueOnce(courseNodes);

      const classAView = await coursesService.getCourseBySlug(
        'school',
        courseSlug,
        'teacher-a',
      );

      expect(classAView.success).toBe(true);
      expect(classAView.data.course.id).toBe(courseId);
      expect(classAView.data.nodes).toHaveLength(2);

      // Setup for Class B (same course, different access)
      prismaMock.member.findFirst.mockResolvedValueOnce({
        userId: 'teacher-b',
        role: 'teacher',
        organization: { id: orgId, name: 'School', slug: 'school' },
      });

      prismaMock.course.findUnique.mockResolvedValueOnce(sharedCourse);
      prismaMock.lessonNode.findMany.mockResolvedValueOnce(courseNodes);

      const classBView = await coursesService.getCourseBySlug(
        'school',
        courseSlug,
        'teacher-b',
      );

      expect(classBView.success).toBe(true);
      expect(classBView.data.course.id).toBe(courseId);

      // Verify both teachers see same course but can manage independently
      expect(classAView.data.course.id).toBe(classBView.data.course.id);
      expect(classAView.data.nodes).toEqual(classBView.data.nodes);
    });
  });

  describe('Student Learning Path Workflow', () => {
    it('should retrieve complete learning path: course structure -> class assignments', async () => {
      const studentId = 'student-123';
      const classId = 'class-10a';
      const courseId = 'course-math';

      // Step 1: Student views their class
      prismaMock.classMember.findUnique.mockResolvedValueOnce({
        userId: studentId,
        role: ClassRole.student,
      });

      const classWithCourseData = {
        id: classId,
        name: 'Class 10A - Math',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [
          {
            userId: studentId,
            role: ClassRole.student,
            user: {
              id: studentId,
              name: 'Student Name',
              email: 'student@example.com',
              image: null,
            },
          },
        ],
        groups: [],
        course: {
          id: courseId,
          name: 'Mathematics',
          rootLessonNodeId: 'root-m',
          createdBy: 'teacher-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const learningPath = [
        {
          id: 'root-m',
          title: 'Mathematics',
          type: LessonNodeType.course,
          content: {},
          order: 0,
          parentId: null,
          courseId,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 1 },
        },
        {
          id: 'chapter-1',
          title: 'Chapter 1: Algebra',
          type: LessonNodeType.module,
          content: { content: 'Chapter content' },
          order: 0,
          parentId: 'root-m',
          courseId,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 2 },
        },
        {
          id: 'topic-1-1',
          title: 'Topic 1.1: Linear Equations',
          type: LessonNodeType.lesson,
          content: { content: 'Lesson content' },
          order: 0,
          parentId: 'chapter-1',
          courseId,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 1 },
        },
        {
          id: 'hw-1-1',
          title: 'Assignment 1.1: Solve Equations',
          type: LessonNodeType.homework,
          content: { widgetId: 'math-problem', widgetVersion: '1.0' },
          order: 0,
          parentId: 'topic-1-1',
          courseId,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 0 },
        },
      ];

      prismaMock.class.findUnique.mockResolvedValue(classWithCourseData);
      prismaMock.lessonNode.findMany.mockResolvedValue(learningPath);

      // Execute: Student gets their class view
      const result = await classesService.getClassWithCourse(classId, studentId);

      // Verify: Student can see complete learning path
      expect(result.success).toBe(true);
      expect(result.role).toBe(ClassRole.student);
      expect(result.data.nodes).toHaveLength(4);

      // Verify learning path structure
      const [course, chapter, topic, assignment] = result.data.nodes;
      expect(course.type).toBe(LessonNodeType.course);
      expect(chapter.type).toBe(LessonNodeType.module);
      expect(topic.type).toBe(LessonNodeType.lesson);
      expect(assignment.type).toBe(LessonNodeType.homework);

      // Verify hierarchy
      expect(chapter.parentId).toBe(course.id);
      expect(topic.parentId).toBe(chapter.id);
      expect(assignment.parentId).toBe(topic.id);
    });
  });
});
