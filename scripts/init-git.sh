#!/bin/bash

# ============================================================================
# GIT INITIALIZATION AND FIRST PUSH
# ============================================================================
# This script initializes git and pushes to GitHub
# Run this from the project root: bash scripts/init-git.sh
# ============================================================================

set -e  # Exit on error

echo "🚀 Initializing Git Repository..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Repository URL
REPO_URL="https://github.com/jliou90/f45.git"

# ============================================================================
# 1. Initialize Git (if not already initialized)
# ============================================================================

if [ ! -d .git ]; then
    echo -e "${BLUE}📦 Initializing Git repository...${NC}"
    git init
    echo -e "${GREEN}✅ Git initialized${NC}"
    echo ""
else
    echo -e "${YELLOW}ℹ️  Git already initialized${NC}"
    echo ""
fi

# ============================================================================
# 2. Configure Git (optional - update with your info)
# ============================================================================

echo -e "${BLUE}👤 Configuring Git user...${NC}"
# Uncomment and update these with your information:
# git config user.name "Your Name"
# git config user.email "your.email@example.com"
echo -e "${YELLOW}ℹ️  Using global Git config${NC}"
echo ""

# ============================================================================
# 3. Add remote origin
# ============================================================================

echo -e "${BLUE}🔗 Adding remote origin...${NC}"

# Check if origin already exists
if git remote | grep -q "^origin$"; then
    echo -e "${YELLOW}ℹ️  Remote 'origin' already exists${NC}"
    echo -e "${YELLOW}   Current URL: $(git remote get-url origin)${NC}"
    
    # Ask if user wants to update it
    read -p "Update remote URL? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git remote set-url origin "$REPO_URL"
        echo -e "${GREEN}✅ Remote URL updated${NC}"
    fi
else
    git remote add origin "$REPO_URL"
    echo -e "${GREEN}✅ Remote 'origin' added: $REPO_URL${NC}"
fi
echo ""

# ============================================================================
# 4. Stage all files
# ============================================================================

echo -e "${BLUE}📝 Staging files...${NC}"
git add .
echo -e "${GREEN}✅ Files staged${NC}"
echo ""

# Show what will be committed
echo -e "${BLUE}📋 Files to be committed:${NC}"
git status --short
echo ""

# ============================================================================
# 5. Create initial commit
# ============================================================================

echo -e "${BLUE}💾 Creating initial commit...${NC}"

# Check if there are any commits
if git rev-parse HEAD >/dev/null 2>&1; then
    echo -e "${YELLOW}ℹ️  Repository already has commits${NC}"
    echo -e "${YELLOW}   Creating new commit...${NC}"
    git commit -m "chore: update project documentation and structure

- Add comprehensive README.md
- Add CONTRIBUTING.md guide
- Add LICENSE file
- Update .gitignore
- Complete auth module (70%)
- Add middleware stack (42 functions)
- Implement RBAC and security features

Project Status: Phase 1 - 70% Complete
Total Files: 78
Lines of Code: 13,000+"
else
    git commit -m "chore: initial commit - enterprise DMS platform

Project Features:
- Complete monorepo structure with Turborepo
- 7 shared packages (database, types, constants, utils, validation, api-client)
- Backend API with Express and Prisma
- Complete auth module with extraordinary middleware stack
- Type-safe architecture with TypeScript
- 40+ database models
- 80+ utility functions
- 42 middleware functions
- RBAC and permission system
- Rate limiting and audit logging

Architecture:
- Layered architecture (Controller → Service → Repository)
- Repository pattern for data access
- DTO pattern for API contracts
- Mapper pattern for transformations
- Complete middleware security stack

Progress: Phase 1 - 70% Complete
Total Files: 78
Lines of Code: 13,000+"
fi

echo -e "${GREEN}✅ Commit created${NC}"
echo ""

# ============================================================================
# 6. Push to GitHub
# ============================================================================

echo -e "${BLUE}🚀 Pushing to GitHub...${NC}"
echo ""

# Ask for confirmation
read -p "Push to GitHub now? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    # Check if main branch exists on remote
    if git ls-remote --heads origin main | grep -q main; then
        echo -e "${YELLOW}ℹ️  Main branch exists on remote${NC}"
        git push origin main
    else
        echo -e "${YELLOW}ℹ️  Creating main branch on remote${NC}"
        git branch -M main
        git push -u origin main
    fi
    
    echo ""
    echo -e "${GREEN}✅ Successfully pushed to GitHub!${NC}"
    echo ""
    echo -e "${GREEN}🎉 Your code is now on GitHub!${NC}"
    echo -e "${BLUE}📍 Repository: $REPO_URL${NC}"
else
    echo -e "${YELLOW}ℹ️  Skipped push to GitHub${NC}"
    echo ""
    echo -e "${BLUE}📍 To push later, run:${NC}"
    echo "   git push -u origin main"
fi

echo ""

# ============================================================================
# 7. Summary
# ============================================================================

echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Git Setup Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📊 Repository Status:${NC}"
echo "   • Repository: $REPO_URL"
echo "   • Branch: $(git branch --show-current)"
echo "   • Commits: $(git rev-list --count HEAD 2>/dev/null || echo "0")"
echo "   • Files: $(git ls-files | wc -l)"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "   1. Visit your repository: $REPO_URL"
echo "   2. Add repository description and topics"
echo "   3. Configure branch protection rules"
echo "   4. Set up GitHub Actions (CI/CD)"
echo "   5. Invite collaborators"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
echo ""
