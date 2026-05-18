import { Test, TestingModule } from '@nestjs/testing';
import { ClassesService } from '../../src/classes/classes.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ClassRole } from '@repo/db';

/**
 * Integration Tests for Classes Workflow
 * Tests complex workflows involving class creation, member management, and role-based access
 */
describe('Classes Workflow Integration Tests', () => {
  let classesService: ClassesService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      classMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      class: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      lessonNode: {
        findMany: jest.fn(),
      },
      member: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    classesService = module.get<ClassesService>(ClassesService);
  });

  describe('Class Creation and Member Assignment Workflow', () => {
    it('should create class and set creator as owner', async () => {
      const userId = 'teacher-123';
      const organizationId = 'org-123';
      const courseId = 'course-123';
      const className = 'Class 10A';

      // Step 1: Verify creator is org member
      prismaMock.member.findFirst.mockResolvedValue({
        userId,
      });

      // Step 2: Create class and assign owner
      const newClass = {
        id: 'class-123',
        name: className,
        courseId,
      };

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const tx = {
          class: {
            create: jest.fn().mockResolvedValue(newClass),
          },
          classMember: {
            create: jest
              .fn()
              .mockResolvedValue({ classId: newClass.id, userId, role: ClassRole.owner }),
          },
        };
        return callback(tx);
      });

      // Execute workflow
      const result = await classesService.createClass(
        className,
        courseId,
        organizationId,
        userId,
      );

      // Verify
      expect(result.id).toBe('class-123');
      expect(result.name).toBe(className);

      // Verify transaction was used (ensures atomicity)
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });
  });

  describe('Class Member Role Management Workflow', () => {
    it('should build complete class with members of different roles', async () => {
      const classId = 'class-123';
      const ownerId = 'user-owner-1';
      const teacherId = 'user-teacher-1';
      const studentId1 = 'user-student-1';
      const studentId2 = 'user-student-2';

      // Step 1: Add owner
      prismaMock.classMember.create.mockResolvedValueOnce({
        classId,
        userId: ownerId,
        role: ClassRole.owner,
        joinedAt: new Date('2024-01-01'),
      });

      const ownerAdded = await classesService.addClassMember(
        classId,
        ownerId,
        ClassRole.owner,
      );
      expect(ownerAdded.role).toBe(ClassRole.owner);

      // Step 2: Add teacher
      prismaMock.classMember.create.mockResolvedValueOnce({
        classId,
        userId: teacherId,
        role: ClassRole.teacher,
        joinedAt: new Date('2024-01-02'),
      });

      const teacherAdded = await classesService.addClassMember(
        classId,
        teacherId,
        ClassRole.teacher,
      );
      expect(teacherAdded.role).toBe(ClassRole.teacher);

      // Step 3: Add students
      prismaMock.classMember.create.mockResolvedValueOnce({
        classId,
        userId: studentId1,
        role: ClassRole.student,
        joinedAt: new Date('2024-01-03'),
      });

      const student1Added = await classesService.addClassMember(
        classId,
        studentId1,
        ClassRole.student,
      );
      expect(student1Added.role).toBe(ClassRole.student);

      prismaMock.classMember.create.mockResolvedValueOnce({
        classId,
        userId: studentId2,
        role: ClassRole.student,
        joinedAt: new Date('2024-01-04'),
      });

      const student2Added = await classesService.addClassMember(
        classId,
        studentId2,
        ClassRole.student,
      );
      expect(student2Added.role).toBe(ClassRole.student);

      // Verify all members added
      expect(prismaMock.classMember.create).toHaveBeenCalledTimes(4);
    });

    it('should retrieve user classes grouped by role', async () => {
      const userId = 'user-multi-role';

      const classMembers = [
        {
          userId,
          role: ClassRole.owner,
          joinedAt: new Date('2024-01-01'),
          class: {
            id: 'class-owned-1',
            name: 'My Class 1',
            course: { id: 'course-1', name: 'Math' },
            _count: { members: 20 },
          },
        },
        {
          userId,
          role: ClassRole.owner,
          joinedAt: new Date('2024-01-05'),
          class: {
            id: 'class-owned-2',
            name: 'My Class 2',
            course: { id: 'course-2', name: 'Physics' },
            _count: { members: 15 },
          },
        },
        {
          userId,
          role: ClassRole.teacher,
          joinedAt: new Date('2024-02-01'),
          class: {
            id: 'class-teach-1',
            name: 'Teaching Class',
            course: { id: 'course-3', name: 'English' },
            _count: { members: 30 },
          },
        },
        {
          userId,
          role: ClassRole.student,
          joinedAt: new Date('2024-03-01'),
          class: {
            id: 'class-study-1',
            name: 'Studying Class 1',
            course: { id: 'course-4', name: 'Science' },
            _count: { members: 25 },
          },
        },
        {
          userId,
          role: ClassRole.student,
          joinedAt: new Date('2024-03-10'),
          class: {
            id: 'class-study-2',
            name: 'Studying Class 2',
            course: { id: 'course-5', name: 'History' },
            _count: { members: 28 },
          },
        },
      ];

      prismaMock.classMember.findMany.mockResolvedValue(classMembers);

      // Execute
      const result = await classesService.getUserClasses(userId);

      // Verify grouping
      expect(result.owner).toHaveLength(2);
      expect(result.teacher).toHaveLength(1);
      expect(result.student).toHaveLength(2);

      // Verify role information preserved
      expect(result.owner[0].role).toBe(ClassRole.owner);
      expect(result.teacher[0].role).toBe(ClassRole.teacher);
      expect(result.student[0].role).toBe(ClassRole.student);
    });
  });

  describe('Class Details Retrieval with Authorization', () => {
    it('should retrieve class with members and course structure', async () => {
      const classId = 'class-123';
      const userId = 'user-123';

      // Step 1: Check authorization
      prismaMock.classMember.findUnique.mockResolvedValueOnce({
        userId,
        role: ClassRole.teacher,
      });

      // Step 2: Retrieve class details
      const classData = {
        id: classId,
        name: 'Class 10A',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        members: [
          {
            userId: 'teacher-1',
            role: ClassRole.teacher,
            user: {
              id: 'teacher-1',
              name: 'Mr. Smith',
              email: 'smith@example.com',
              image: null,
            },
          },
          {
            userId: 'student-1',
            role: ClassRole.student,
            user: {
              id: 'student-1',
              name: 'John Doe',
              email: 'john@example.com',
              image: null,
            },
          },
          {
            userId: 'student-2',
            role: ClassRole.student,
            user: {
              id: 'student-2',
              name: 'Jane Smith',
              email: 'jane@example.com',
              image: null,
            },
          },
        ],
        groups: [], // Empty groups for simplicity
        course: {
          id: 'course-123',
          name: 'Mathematics',
          rootLessonNodeId: 'root-123',
          createdBy: 'creator-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      prismaMock.class.findUnique.mockResolvedValue(classData);

      // Step 3: Retrieve course structure
      const nodes = [
        {
          id: 'root-123',
          title: 'Mathematics',
          type: 'course',
          content: {},
          order: 0,
          parentId: null,
          courseId: 'course-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 2 },
        },
        {
          id: 'module-1',
          title: 'Module 1',
          type: 'module',
          content: {},
          order: 0,
          parentId: 'root-123',
          courseId: 'course-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 1 },
        },
        {
          id: 'lesson-1',
          title: 'Lesson 1',
          type: 'lesson',
          content: {},
          order: 0,
          parentId: 'module-1',
          courseId: 'course-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 0 },
        },
      ];

      prismaMock.lessonNode.findMany.mockResolvedValue(nodes);

      // Execute
      const result = await classesService.getClassWithCourse(classId, userId);

      // Verify authorization passed
      expect(result.role).toBe(ClassRole.teacher);

      // Verify class data
      expect(result.data.classData.id).toBe(classId);
      expect(result.data.classData.members).toHaveLength(3);

      // Verify course structure
      expect(result.data.nodes).toHaveLength(3);
      expect(result.data.nodes[0].type).toBe('course');
      expect(result.data.nodes[1].type).toBe('module');
      expect(result.data.nodes[2].type).toBe('lesson');

      // Verify hierarchy integrity
      const root = result.data.nodes.find((n) => n.type === 'course');
      const modules = result.data.nodes.filter((n) => n.type === 'module');
      const lessons = result.data.nodes.filter((n) => n.type === 'lesson');

      expect(modules[0].parentId).toBe(root.id);
      expect(lessons[0].parentId).toBe(modules[0].id);
    });

    it('should deny access if user is not class member', async () => {
      const classId = 'class-unauthorized';
      const userId = 'user-123';

      prismaMock.classMember.findUnique.mockResolvedValueOnce(null);

      await expect(
        classesService.getClassWithCourse(classId, userId),
      ).rejects.toThrow('Forbidden');
    });
  });

  describe('Teacher Access Control Workflow', () => {
    it('should allow teacher to view class students', async () => {
      const classId = 'class-123';
      const teacherId = 'teacher-123';

      // Step 1: Verify requester is teacher
      prismaMock.classMember.findUnique.mockResolvedValueOnce({
        role: ClassRole.teacher,
      });

      // Step 2: Retrieve students
      const students = [
        {
          userId: 'student-1',
          role: ClassRole.student,
          joinedAt: new Date('2024-01-01'),
          user: {
            id: 'student-1',
            name: 'Alice',
            email: 'alice@example.com',
            image: null,
          },
        },
        {
          userId: 'student-2',
          role: ClassRole.student,
          joinedAt: new Date('2024-01-02'),
          user: {
            id: 'student-2',
            name: 'Bob',
            email: 'bob@example.com',
            image: null,
          },
        },
        {
          userId: 'student-3',
          role: ClassRole.student,
          joinedAt: new Date('2024-01-03'),
          user: {
            id: 'student-3',
            name: 'Charlie',
            email: 'charlie@example.com',
            image: null,
          },
        },
      ];

      prismaMock.classMember.findMany.mockResolvedValue(students);

      // Execute
      const result = await classesService.getClassStudents(classId, teacherId);

      // Verify
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 'student-1',
        name: 'Alice',
        email: 'alice@example.com',
        image: null,
      });
      expect(result[1]).toEqual({
        id: 'student-2',
        name: 'Bob',
        email: 'bob@example.com',
        image: null,
      });
      expect(result[2]).toEqual({
        id: 'student-3',
        name: 'Charlie',
        email: 'charlie@example.com',
        image: null,
      });
    });

    it('should deny student from viewing class students', async () => {
      const classId = 'class-123';
      const studentId = 'student-123';

      prismaMock.classMember.findUnique.mockResolvedValueOnce({
        role: ClassRole.student,
      });

      await expect(
        classesService.getClassStudents(classId, studentId),
      ).rejects.toThrow('Forbidden');
    });

    it('should allow owner to view class students', async () => {
      const classId = 'class-123';
      const ownerId = 'owner-123';

      // Owner should be treated like teacher
      prismaMock.classMember.findUnique.mockResolvedValueOnce({
        role: ClassRole.owner,
      });

      const students = [
        {
          userId: 'student-1',
          role: ClassRole.student,
          joinedAt: new Date(),
          user: {
            id: 'student-1',
            name: 'Student One',
            email: 'student@example.com',
            image: null,
          },
        },
      ];

      prismaMock.classMember.findMany.mockResolvedValue(students);

      // Execute
      const result = await classesService.getClassStudents(classId, ownerId);

      // Verify owner can access
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('student-1');
    });
  });
});
