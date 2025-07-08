# Cron Scheduler Registry Development Session - 2025-06-26 12:15

## Session Overview
- **Start Time:** 2025-06-26 12:15
- **Session Name:** cron-scheduler-registry
- **Branch:** feature/sku-domain

## Goals
Create a cron scheduler registry system that allows scheduling cron jobs with environment-specific execution. 

**Primary Objective:**
- Schedule `handleGenerateAndSendPostbackCsv` from postback-file.service.ts to run:
  - Monday-Thursday at 6PM
  - Friday at 4PM  
  - ONLY in production environment

**Technical Requirements:**
- Environment-aware cron job execution
- Flexible scheduling system for different methods
- Registry pattern for managing multiple cron jobs
- Integration with existing NestJS application structure

## Progress

### ✅ **IMPLEMENTATION COMPLETED**

**Core System Built:**
1. **Environment-Aware Cron Decorator** (`@EnvironmentCron`)
2. **Cron Scheduler Registry Service** with auto-discovery
3. **Postback CSV Scheduling** (Mon-Thu 6PM, Fri 4PM, production only)
4. **Management API** for job control and monitoring
5. **Testing Infrastructure** for non-production environments

**Files Created/Modified:**
- `src/shared/decorators/environment-cron.decorator.ts` (NEW)
- `src/shared/services/cron-scheduler-registry.service.ts` (NEW)
- `src/shared/infrastructure/http/v1/cron-scheduler.controller.ts` (NEW)
- `src/shared/decorators/README.md` (NEW - Documentation)
- `src/postback/application/postback-file.service.ts` (MODIFIED - Added new cron jobs)
- `src/shared/shared.module.ts` (MODIFIED - Added cron registry)
- `src/app.module.ts` (MODIFIED - Added SharedModule and PostbackModule)

---

## 🧪 **TESTING PROCEDURES (Non-Production)**

Since the production jobs only run in production environment, here are comprehensive testing methods:

### **Method 1: Development Test Job (Recommended)**

A test job has been added that runs every 30 seconds in development/staging:

```bash
# Start the development server
npm run dev

# Watch the logs for test job execution every 30 seconds:
# [PostbackFileService] 🧪 TEST JOB: Postback CSV generation (development/staging only)
```

**What you'll see:**
- Test job runs every 30 seconds
- Production jobs show as "Skipped" in startup logs
- Full cron scheduler registry summary at startup

### **Method 2: Manual API Triggers**

Test the actual production logic without waiting for schedule:

```bash
# 1. Start the API in development
npm run dev

# 2. Get authentication token (as admin user)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# 3. List all registered cron jobs
curl -X GET http://localhost:3000/api/v1/cron-scheduler/jobs \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Manually trigger weekday postback job (tests the actual logic)
curl -X POST http://localhost:3000/api/v1/cron-scheduler/jobs/weekday-postback-csv/trigger \
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. Manually trigger Friday postback job
curl -X POST http://localhost:3000/api/v1/cron-scheduler/jobs/friday-postback-csv/trigger \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Method 3: Temporary Environment Override**

Test production jobs in development by temporarily changing environment:

```bash
# Option A: Environment variable override
NODE_ENV=production npm run dev

# Option B: Modify the PostbackFileService temporarily
# In postback-file.service.ts, change:
# environments: ['production']
# to:
# environments: ['development', 'production']
```

### **Method 4: Staging Environment Test**

Deploy to staging with production-like configuration:

```bash
# Deploy to staging environment
# Set NODE_ENV=production in staging
# Jobs will run on actual schedule in staging
```

### **Method 5: Test with Different Schedules**

Temporarily modify cron schedules for faster testing:

```typescript
// In PostbackFileService, temporarily change:
cronTime: '0 0 18 * * 1-4', // Mon-Thu at 6PM
// to:
cronTime: '*/2 * * * *', // Every 2 minutes

cronTime: '0 0 16 * * 5', // Fri at 4PM  
// to:
cronTime: '*/3 * * * *', // Every 3 minutes
```

### **Expected Log Output During Testing:**

**Development Startup:**
```
[CronSchedulerRegistryService] Cron Scheduler Registry initialized for environment: development
[CronSchedulerRegistryService] Registered and started cron job: test-postback-csv (*/30 * * * * *) for environment: development
[CronSchedulerRegistryService] Skipped cron job: weekday-postback-csv (not configured for environment: development)
[CronSchedulerRegistryService] Skipped cron job: friday-postback-csv (not configured for environment: development)
[CronSchedulerRegistryService] === Cron Scheduler Registry Summary ===
[CronSchedulerRegistryService] Environment: development
[CronSchedulerRegistryService] Total registered jobs: 3
[CronSchedulerRegistryService] Active jobs: 1
[CronSchedulerRegistryService] Active cron jobs:
[CronSchedulerRegistryService]   - test-postback-csv: */30 * * * * * (America/New_York)
[CronSchedulerRegistryService] Inactive jobs (wrong environment):
[CronSchedulerRegistryService]   - weekday-postback-csv: requires [production]
[CronSchedulerRegistryService]   - friday-postback-csv: requires [production]
```

**Production Startup:**
```
[CronSchedulerRegistryService] Cron Scheduler Registry initialized for environment: production
[CronSchedulerRegistryService] Registered and started cron job: weekday-postback-csv (0 0 18 * * 1-4) for environment: production
[CronSchedulerRegistryService] Registered and started cron job: friday-postback-csv (0 0 16 * * 5) for environment: production
[CronSchedulerRegistryService] Skipped cron job: test-postback-csv (not configured for environment: production)
[CronSchedulerRegistryService] Active jobs: 2
```

### **Verification Steps:**

1. **System Startup**: Check logs show correct job registration for environment
2. **Test Job Execution**: Verify test job runs every 30 seconds in dev
3. **API Endpoints**: Test manual job triggering via API
4. **Production Logic**: Manually trigger production jobs to test actual CSV generation
5. **Environment Filtering**: Confirm jobs only run in specified environments

### **Troubleshooting:**

- **No jobs registered**: Check SharedModule is imported in AppModule
- **Jobs not running**: Verify ScheduleModule.forRoot() is configured
- **API endpoints not working**: Ensure authentication and admin role
- **Test job not visible**: Check NODE_ENV is 'development' or 'staging'

This testing approach allows full validation of the cron scheduler system without deploying to production or waiting for actual schedule times.