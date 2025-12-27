# Contributing to Enterprise DMS Platform

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

---

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors.

### Expected Behavior

- Be respectful and considerate
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Be collaborative

### Unacceptable Behavior

- Harassment or discrimination of any kind
- Trolling or insulting comments
- Publishing others' private information
- Any conduct that could be considered inappropriate

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or higher
- PostgreSQL 15.x
- Git
- Basic understanding of TypeScript, React, and Node.js

### Setting Up Development Environment

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/f45.git
   cd f45
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp services/api/.env.example services/api/.env
   cp apps/web/.env.example apps/web/.env
   # Edit .env files with your local configuration
   ```

4. **Set up database**
   ```bash
   createdb dms_dev
   cd packages/database
   npx prisma migrate dev
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

---

## 🔄 Development Workflow

### 1. Create a Branch

Create a feature branch from `main`:

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates
- `chore/` - Maintenance tasks

### 2. Make Your Changes

- Follow our [coding standards](#coding-standards)
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and focused

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run type checking
npm run type-check

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

### 4. Commit Your Changes

Follow our [commit guidelines](#commit-guidelines):

```bash
git add .
git commit -m "feat: add user profile feature"
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## 💻 Coding Standards

### TypeScript

**Use strict TypeScript:**
```typescript
// ✅ Good
function getUser(id: string): Promise<User> {
  return userRepository.findById(id);
}

// ❌ Bad - avoid any
function getUser(id: any): any {
  return userRepository.findById(id);
}
```

**Prefer interfaces over types for objects:**
```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
}

// ❌ Less preferred
type User = {
  id: string;
  name: string;
}
```

### File Organization

**One function per file for utilities:**
```
utils/
├── formatters/
│   ├── currency/
│   │   ├── formatCurrency.ts
│   │   ├── parseCurrency.ts
│   │   └── index.ts
```

**Module pattern for features:**
```
modules/auth/
├── controllers/
├── services/
├── repositories/
├── dto/
├── mappers/
├── middleware/
├── constants/
├── types/
└── tests/
```

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| **Files** | kebab-case | `user-service.ts` |
| **Classes** | PascalCase | `UserService` |
| **Interfaces** | PascalCase | `UserDto` |
| **Functions** | camelCase | `getUserById()` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS` |
| **Components** | PascalCase | `UserProfile` |

### Code Style

**Use async/await over promises:**
```typescript
// ✅ Good
async function login(data: LoginDto) {
  const user = await userRepository.findByUsername(data.username);
  return user;
}

// ❌ Bad
function login(data: LoginDto) {
  return userRepository.findByUsername(data.username)
    .then(user => user);
}
```

**Always handle errors:**
```typescript
// ✅ Good
try {
  const user = await userRepository.findById(id);
  return user;
} catch (error) {
  logger.error('Error finding user:', error);
  throw ApiError.internal('Failed to find user');
}

// ❌ Bad - no error handling
const user = await userRepository.findById(id);
return user;
```

**Use descriptive variable names:**
```typescript
// ✅ Good
const isUserActive = user.isActive;
const hasPermission = checkPermission(user, 'read');

// ❌ Bad
const flag = user.isActive;
const x = checkPermission(user, 'read');
```

### Documentation

**Add JSDoc comments for public functions:**
```typescript
/**
 * Find user by ID
 * 
 * @param id - User ID
 * @returns User object or null if not found
 * @throws {ApiError} If database query fails
 * 
 * @example
 * const user = await findUserById('123');
 */
export async function findUserById(id: string): Promise<User | null> {
  // Implementation
}
```

---

## 📝 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting) |
| `refactor` | Code refactoring |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |
| `perf` | Performance improvements |

### Examples

```bash
# Feature
git commit -m "feat(auth): add password reset functionality"

# Bug fix
git commit -m "fix(api): correct rate limiting logic"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Refactoring
git commit -m "refactor(auth): extract validation logic to separate file"

# Multiple changes (with body)
git commit -m "feat(users): add user profile management

- Add GET /users/:id/profile endpoint
- Add PUT /users/:id/profile endpoint
- Add profile validation schema
- Add profile mapper

Closes #123"
```

### Commit Best Practices

- Keep commits atomic (one logical change per commit)
- Write clear, descriptive commit messages
- Reference issues in commit messages
- Don't commit incomplete features
- Don't commit commented-out code
- Don't commit console.logs or debugger statements

---

## 🔍 Pull Request Process

### Before Creating a PR

1. ✅ All tests pass
2. ✅ Code follows style guidelines
3. ✅ Documentation is updated
4. ✅ No console.logs or debugger statements
5. ✅ Branch is up to date with main

### PR Title

Follow the same format as commits:
```
feat(auth): add two-factor authentication
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots here

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally

## Related Issues
Closes #123
```

### Review Process

1. At least one approval required
2. All CI checks must pass
3. No merge conflicts
4. Code reviewed for:
   - Correctness
   - Performance
   - Security
   - Maintainability
   - Test coverage

### After PR is Merged

1. Delete your feature branch
2. Update your local main branch
3. Close related issues

---

## 🧪 Testing

### Test Structure

```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── e2e/           # End-to-end tests
```

### Writing Tests

**Unit test example:**
```typescript
describe('UserService', () => {
  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '1', name: 'John' };
      userRepository.findById = jest.fn().mockResolvedValue(mockUser);
      
      const result = await userService.findById('1');
      
      expect(result).toEqual(mockUser);
    });

    it('should throw error when user not found', async () => {
      userRepository.findById = jest.fn().mockResolvedValue(null);
      
      await expect(userService.findById('999'))
        .rejects
        .toThrow('User not found');
    });
  });
});
```

### Test Coverage

- Aim for 80%+ coverage
- All new features must have tests
- Critical paths must be tested
- Edge cases should be covered

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- auth.service.test.ts

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

---

## 📚 Documentation

### What to Document

- Public APIs and functions
- Complex algorithms
- Configuration options
- Setup and deployment procedures
- Architecture decisions

### Documentation Standards

**Inline comments:**
```typescript
// Brief explanation for single lines
const result = complexCalculation(); // What it does

/**
 * Detailed explanation for functions
 * 
 * @param param1 - Description
 * @returns Description
 */
function myFunction(param1: string): number {
  // Implementation
}
```

**README files:**
- Every package should have a README
- Every module should have documentation
- Keep READMEs up to date

**Architecture Decision Records (ADRs):**
- Document significant decisions
- Explain rationale
- Note alternatives considered

---

## ❓ Questions?

- Check existing [Issues](https://github.com/jliou90/f45/issues)
- Start a [Discussion](https://github.com/jliou90/f45/discussions)
- Review [Documentation](docs/)

---

## 🎉 Thank You!

Thank you for contributing to Enterprise DMS Platform! Your efforts help make this project better for everyone.

**Happy coding!** 🚀
