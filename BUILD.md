# Build and Deployment Guide

This document provides comprehensive information about building, testing, and deploying the Snowflake MCP Server.

## Prerequisites

- Node.js 20.0.0 or higher
- npm or yarn package manager
- Docker (for containerized deployment)
- Git (for version control)

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build:prod

# Run tests
npm test

# Run linting and formatting
npm run validate
```

## Build Configuration

### TypeScript Configuration

The project uses TypeScript with the following configurations:

- **Main Config** (`tsconfig.json`): For source code compilation
- **Test Config** (`tsconfig.test.json`): For test files with Jest types

Key TypeScript settings:

- Target: ES2022
- Module: ESNext
- Strict mode enabled
- Source maps and declarations generated
- Incremental compilation for faster builds

### Build Scripts

| Script                | Description                                  |
| --------------------- | -------------------------------------------- |
| `npm run build`       | Standard build with source maps              |
| `npm run build:prod`  | Production build (optimized, no source maps) |
| `npm run build:watch` | Build with watch mode                        |
| `npm run clean`       | Clean build artifacts                        |

### Code Quality

#### ESLint Configuration

- TypeScript-aware linting
- Prettier integration
- Separate rules for source and test files
- Supports both `src/` and `tests/` directories

#### Prettier Configuration

- Consistent code formatting
- Auto-fixes on save
- Integrated with ESLint
- Cross-platform line ending handling

#### Quality Scripts

| Script                 | Description                      |
| ---------------------- | -------------------------------- |
| `npm run lint`         | Run ESLint                       |
| `npm run lint:fix`     | Fix auto-fixable issues          |
| `npm run format`       | Format code with Prettier        |
| `npm run format:check` | Check formatting without changes |
| `npm run typecheck`    | Run TypeScript type checking     |
| `npm run validate`     | Run all quality checks           |

## Testing

### Test Types

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **Performance Tests**: Load and performance validation

### Test Scripts

| Script                     | Description                  |
| -------------------------- | ---------------------------- |
| `npm test`                 | Run all tests                |
| `npm run test:unit`        | Run unit tests only          |
| `npm run test:integration` | Run integration tests only   |
| `npm run test:performance` | Run performance tests        |
| `npm run test:coverage`    | Generate coverage report     |
| `npm run test:watch`       | Run tests in watch mode      |
| `npm run test:ci`          | Run tests for CI environment |

### Coverage Requirements

- Minimum 80% coverage for branches, functions, lines, and statements
- Coverage reports generated in `coverage/` directory
- HTML and LCOV formats supported

## Docker Deployment

### Docker Images

The project includes multiple Docker configurations:

#### Production Image (`Dockerfile`)

- Multi-stage build for optimal size
- Non-root user for security
- Health checks included
- Alpine Linux base for minimal footprint

```bash
# Build production image
docker build -t snowflake-mcp-server .

# Run container
docker run --rm -it snowflake-mcp-server
```

#### Development Image (`Dockerfile.dev`)

- Includes development dependencies
- Hot reload support
- Debugging tools included

```bash
# Build development image
docker build -f Dockerfile.dev -t snowflake-mcp-server:dev .

# Run development container
docker run --rm -it -v $(pwd):/app snowflake-mcp-server:dev
```

### Docker Compose

Use `docker-compose.yml` for orchestrated deployment:

```bash
# Start production services
docker-compose up -d

# Start development services
docker-compose --profile dev up -d

# Stop services
docker-compose down
```

### Environment Variables

Required environment variables for Docker deployment:

```env
SNOWFLAKE_ACCOUNT=your-account
SNOWFLAKE_USER=your-username
SNOWFLAKE_PASSWORD=your-password
SNOWFLAKE_DATABASE=your-database
SNOWFLAKE_SCHEMA=your-schema
SNOWFLAKE_WAREHOUSE=your-warehouse
SNOWFLAKE_ROLE=your-role
SNOWFLAKE_AUTHENTICATOR=snowflake  # or externalbrowser
```

## CI/CD Pipeline

### GitHub Actions

The project includes comprehensive GitHub Actions workflows:

#### CI Pipeline (`.github/workflows/ci.yml`)

- **Test and Lint**: Code quality validation
- **Build**: Application compilation
- **Docker**: Container image building
- **Performance**: Performance test execution
- **Security**: Vulnerability scanning

#### Release Pipeline (`.github/workflows/release.yml`)

- **NPM Publishing**: Automated package publishing
- **Docker Publishing**: Multi-platform image publishing
- **GitHub Releases**: Automated release asset creation

### GitLab CI

Alternative GitLab CI configuration (`.gitlab-ci.yml`):

- Parallel job execution
- Caching optimization
- Multi-environment deployment
- Security scanning integration

### Pipeline Triggers

- **Push to main/develop**: Full CI pipeline
- **Pull Requests**: Validation pipeline
- **Tags**: Release pipeline
- **Scheduled**: Security and performance audits

## Build Scripts

### Automated Build Script

Use the build script for consistent builds:

```bash
# Development build
./scripts/build.sh development

# Production build
./scripts/build.sh production

# Skip tests (faster build)
./scripts/build.sh production true
```

### Deployment Script

Automated deployment with validation:

```bash
# Deploy to development
./scripts/deploy.sh latest development

# Deploy to production
./scripts/deploy.sh v1.0.0 production
```

## Makefile Commands

For convenience, use Make commands:

```bash
# Development
make install          # Install dependencies
make dev             # Start development server
make build           # Build application
make test            # Run tests

# Quality
make lint            # Run linter
make format          # Format code
make validate        # Full validation

# Docker
make docker-build    # Build Docker image
make docker-run      # Run Docker container
```

## Performance Optimization

### Build Performance

- **Incremental Compilation**: TypeScript incremental builds
- **Parallel Processing**: Multi-core utilization
- **Caching**: Dependency and build caching
- **Tree Shaking**: Unused code elimination

### Runtime Performance

- **Async Operations**: Non-blocking I/O
- **Connection Pooling**: Database connection reuse
- **Memory Management**: Efficient resource usage
- **Startup Optimization**: Sub-1-second initialization

## Troubleshooting

### Common Build Issues

1. **TypeScript Errors**: Check `tsconfig.json` and type definitions
2. **Linting Failures**: Run `npm run lint:fix` for auto-fixes
3. **Test Failures**: Check test environment and mocks
4. **Docker Build Issues**: Verify Dockerfile and .dockerignore

### Debug Commands

```bash
# Verbose build output
npm run build -- --verbose

# Debug TypeScript compilation
npx tsc --noEmit --listFiles

# Check dependency tree
npm ls

# Audit security vulnerabilities
npm audit
```

### Environment Issues

- **Node Version**: Ensure Node.js 20+ is installed
- **Memory Limits**: Increase Node.js memory if needed
- **File Permissions**: Check script execution permissions
- **Network Access**: Verify registry and Docker hub access

## Security Considerations

### Build Security

- **Dependency Scanning**: Automated vulnerability detection
- **Container Scanning**: Docker image security analysis
- **Code Analysis**: Static security analysis
- **Secrets Management**: Environment variable protection

### Deployment Security

- **Non-root Containers**: Security-hardened Docker images
- **Network Isolation**: Container network security
- **Access Controls**: Role-based deployment permissions
- **Audit Logging**: Deployment activity tracking

## Monitoring and Observability

### Build Monitoring

- **Build Times**: Performance tracking
- **Success Rates**: Build reliability metrics
- **Resource Usage**: CPU and memory monitoring
- **Artifact Sizes**: Bundle size tracking

### Deployment Monitoring

- **Health Checks**: Container health monitoring
- **Performance Metrics**: Runtime performance tracking
- **Error Rates**: Application error monitoring
- **Resource Utilization**: System resource monitoring

## Contributing

### Development Workflow

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Create feature branch: `git checkout -b feature/name`
4. Make changes and add tests
5. Run validation: `npm run validate`
6. Commit changes: `git commit -m "description"`
7. Push and create pull request

### Code Standards

- Follow TypeScript best practices
- Maintain test coverage above 80%
- Use conventional commit messages
- Update documentation for changes
- Ensure all CI checks pass

## Support

For build and deployment issues:

1. Check this documentation
2. Review CI/CD logs
3. Check GitHub Issues
4. Contact the development team

---

This build system is designed for reliability, security, and developer productivity. Regular updates ensure compatibility with the latest tools and best practices.

ok
