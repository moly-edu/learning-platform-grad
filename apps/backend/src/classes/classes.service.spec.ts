import { Test, TestingModule } from '@nestjs/testing';
import { ClassesService } from './classes.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClassRole } from '@repo/db';

describe('ClassesService', () => {
  let service: ClassesService;
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

    service = module.get<ClassesService>(ClassesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkUserInClass', () => {
    it('should return user membership if exists', async () => {
      const classId = 'class-123';
      const userId = 'user-123';

      const membership = {
        userId,
        role: ClassRole.student,
      };

      prismaMock.classMember.findUnique.mockResolvedValue(membership);

      const result = await service.checkUserInClass(classId, userId);

      expect(result).toEqual(membership);
      expect(prismaMock.classMember.findUnique).toHaveBeenCalledWith({
        where: {
          classId_userId: { classId, userId },
        },
        select: {
          userId: true,
          role: true,
        },
      });
    });

    it('should return null if user is not in class', async () => {
      const classId = 'class-123';
      const userId = 'user-123';

      prismaMock.classMember.findUnique.mockResolvedValue(null);

      const result = await service.checkUserInClass(classId, userId);

      expect(result).toBeNull();
    });
  });

  describe('getUserClasses', () => {
    it('should return classes grouped by role', async () => {
      const userId = 'user-123';

      const classMembers = [
        {
          userId,
          role: ClassRole.owner,
          joinedAt: new Date('2024-01-01'),
          class: {
            id: 'class-1',
            name: 'My Class',
            course: { id: 'course-1', name: 'Math' },
            _count: { members: 5 },
          },
        },
        {
          userId,
          role: ClassRole.teacher,
          joinedAt: new Date('2024-02-01'),
          class: {
            id: 'class-2',
            name: 'Teaching Class',
            course: { id: 'course-2', name: 'English' },
            _count: { members: 20 },
          },
        },
        {
          userId,
          role: ClassRole.student,
          joinedAt: new Date('2024-03-01'),
          class: {
            id: 'class-3',
            name: 'Student Class',
            course: { id: 'course-3', name: 'Science' },
            _count: { members: 30 },
          },
        },
      ];

      prismaMock.classMember.findMany.mockResolvedValue(classMembers);

      const result = await service.getUserClasses(userId);

      expect(result.owner).toHaveLength(1);
      expect(result.owner[0].id).toBe('class-1');
      expect(result.owner[0].role).toBe(ClassRole.owner);

      expect(result.teacher).toHaveLength(1);
      expect(result.teacher[0].id).toBe('class-2');
      expect(result.teacher[0].role).toBe(ClassRole.teacher);

      expect(result.student).toHaveLength(1);
      expect(result.student[0].id).toBe('class-3');
      expect(result.student[0].role).toBe(ClassRole.student);
    });

    it('should return empty arrays if user has no classes', async () => {
      const userId = 'user-123';

      prismaMock.classMember.findMany.mockResolvedValue([]);

      const result = await service.getUserClasses(userId);

      expect(result.owner).toHaveLength(0);
      expect(result.teacher).toHaveLength(0);
      expect(result.student).toHaveLength(0);
    });
  });

  describe('getClassWithCourse', () => {
    it('should return class data if user is member', async () => {
      const classId = 'class-123';
      const userId = 'user-123';

      prismaMock.classMember.findUnique.mockResolvedValue({
        userId,
        role: ClassRole.teacher,
      });

      const classData = {
        id: classId,
        name: 'Math Class',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [
          {
            userId,
            role: ClassRole.teacher,
            user: {
              id: userId,
              name: 'Teacher Name',
              email: 'teacher@example.com',
              image: null,
            },
          },
        ],
        groups: [],
        course: {
          id: 'course-123',
          name: 'Math Course',
          rootLessonNodeId: 'root-1',
          createdBy: 'creator-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const nodes = [
        {
          id: 'node-1',
          title: 'Lesson 1',
          type: 'lesson',
          content: {},
          order: 0,
          parentId: 'root-1',
          courseId: 'course-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { children: 0 },
        },
      ];

      prismaMock.class.findUnique.mockResolvedValue(classData);
      prismaMock.lessonNode.findMany.mockResolvedValue(nodes);

      const result = await service.getClassWithCourse(classId, userId);

      expect(result.success).toBe(true);
      expect(result.data.classData).toEqual(classData);
      expect(result.data.nodes).toEqual(nodes);
      expect(result.role).toBe(ClassRole.teacher);
    });

    it('should throw Forbidden error if user is not a member', async () => {
      const classId = 'class-123';
      const userId = 'user-123';

      prismaMock.classMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getClassWithCourse(classId, userId),
      ).rejects.toThrow('Forbidden');
    });

    it('should throw error if class not found', async () => {
      const classId = 'nonexistent';
      const userId = 'user-123';

      prismaMock.classMember.findUnique.mockResolvedValue({
        userId,
        role: ClassRole.student,
      });

      prismaMock.class.findUnique.mockResolvedValue(null);

      await expect(
        service.getClassWithCourse(classId, userId),
      ).rejects.toThrow('Class not found');
    });
  });

  describe('createClass', () => {
    it('should create class with owner if user is org member', async () => {
      const userId = 'user-123';
      const organizationId = 'org-123';
      const courseId = 'course-123';
      const className = 'New Class';

      prismaMock.member.findFirst.mockResolvedValue({
        userId,
      });

      const newClass = {
        id: 'class-new',
        name: className,
        courseId,
      };

      prismaMock.$transaction.mockImplementation(async (callback) => {
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

      const result = await service.createClass(
        className,
        courseId,
        organizationId,
        userId,
      );

      expect(result.id).toBe('class-new');
      expect(result.name).toBe(className);
    });

    it('should throw Forbidden error if user is not org member', async () => {
      const userId = 'user-123';
      const organizationId = 'org-123';

      prismaMock.member.findFirst.mockResolvedValue(null);

      await expect(
        service.createClass('Class', 'course-123', organizationId, userId),
      ).rejects.toThrow('Forbidden');
    });
  });

  describe('addClassMember', () => {
    it('should add member to class with specified role', async () => {
      const classId = 'class-123';
      const userId = 'user-456';
      const role = ClassRole.student;

      const newMember = {
        classId,
        userId,
        role,
      };

      prismaMock.classMember.create.mockResolvedValue(newMember);

      const result = await service.addClassMember(classId, userId, role);

      expect(result).toEqual(newMember);
      expect(prismaMock.classMember.create).toHaveBeenCalledWith({
        data: { classId, userId, role },
      });
    });
  });

  describe('getClassStudents', () => {
    it('should return list of students if requester is teacher', async () => {
      const classId = 'class-123';
      const requesterId = 'teacher-123';

      prismaMock.classMember.findUnique.mockResolvedValue({
        role: ClassRole.teacher,
      });

      const students = [
        {
          userId: 'student-1',
          role: ClassRole.student,
          joinedAt: new Date(),
          user: {
            id: 'student-1',
            name: 'Student One',
            email: 'student1@example.com',
            image: null,
          },
        },
        {
          userId: 'student-2',
          role: ClassRole.student,
          joinedAt: new Date(),
          user: {
            id: 'student-2',
            name: 'Student Two',
            email: 'student2@example.com',
            image: null,
          },
        },
      ];

      prismaMock.classMember.findMany.mockResolvedValue(students);

      const result = await service.getClassStudents(classId, requesterId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'student-1',
        name: 'Student One',
        email: 'student1@example.com',
        image: null,
      });
      expect(result[1]).toEqual({
        id: 'student-2',
        name: 'Student Two',
        email: 'student2@example.com',
        image: null,
      });
    });

    it('should throw Forbidden error if requester is not teacher or owner', async () => {
      const classId = 'class-123';
      const requesterId = 'student-123';

      prismaMock.classMember.findUnique.mockResolvedValue({
        role: ClassRole.student,
      });

      await expect(
        service.getClassStudents(classId, requesterId),
      ).rejects.toThrow('Forbidden');
    });

    it('should throw Forbidden error if user is not in class', async () => {
      const classId = 'class-123';
      const requesterId = 'user-123';

      prismaMock.classMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getClassStudents(classId, requesterId),
      ).rejects.toThrow('Forbidden');
    });
  });
});
