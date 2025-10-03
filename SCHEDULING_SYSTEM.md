# Department-Driven, Shift-Aware Scheduling System

## Overview

This platform now implements a comprehensive department-driven, shift-aware task management system. All tasks, schedules, and assignments are organized around **Departments** and **Shifts**, ensuring clear ownership and timing alignment.

---

## Core Entities

### 1. **Departments** (Foundation)
Departments are the top-level organizational units within your organization.

**Properties:**
- `id`: Unique identifier
- `org_id`: Organization reference
- `name`: Department name (e.g., Kitchen, Housekeeping, Security)
- `description`: Optional description
- `archived_at`: Soft delete timestamp

**Key Features:**
- Every user must belong to at least one department
- Each department contains its own shifts and tasks
- Departments can be managed in the **Departments** page

**Database Table:** `departments`

---

### 2. **Shifts** (Working Schedules)
Shifts define the working periods within a department.

**Properties:**
- `id`: Unique identifier
- `department_id`: Parent department
- `name`: Shift name/label (e.g., Morning, Evening, Night)
- `start_time`: Shift start time
- `end_time`: Shift end time
- `days_of_week`: Array of day numbers (0=Sunday, 1=Monday, etc.)
- `archived_at`: Soft delete timestamp

**Key Features:**
- Each department can have multiple shifts
- Users are assigned to specific shifts
- Tasks can be aligned with shift boundaries
- Managed via the **Departments** page (Shift management section)

**Database Table:** `shifts`

---

### 3. **Task Templates** (Blueprints)
Reusable task definitions that serve as blueprints for actual work.

**Properties:**
- `id`: Unique identifier
- `org_id`: Organization reference
- `department_id`: **Required** - Department this template belongs to
- `title`: Task title
- `description`: Task description
- `steps`: JSON array of step-by-step instructions
- `est_minutes`: Estimated completion time
- `criticality`: Urgency level (1-5)
- `required_proof`: Type of proof required (none, photo, note, dual sign-off)

**Key Features:**
- **Must be assigned to a department**
- Can be used to create one-off tasks or recurring schedules
- Managed in the **Task Templates** page

**Database Table:** `task_templates`

---

### 4. **Schedules** (Automation Rules)
Define when and how task instances are automatically generated.

**Properties:**
- `id`: Unique identifier
- `template_id`: Task template reference
- `type`: Schedule type (window, cron, oneoff)
- `department_id`: Optional department linkage
- `shift_id`: Optional shift linkage
- `assignee_role`: Role-based assignment (crew, location_manager, org_admin)
- `days_of_week`: For window schedules
- `window_start/window_end`: Time window
- `cron_expr`: For cron schedules

**Key Features:**
- Supports multiple schedule types (daily windows, cron expressions, one-off)
- Can be linked to specific departments and shifts
- Automatically generates task instances based on rules
- Managed in the **Schedules** page

**Database Table:** `schedules`

---

### 5. **Task Instances** (Actual Work)
Concrete tasks generated from templates, assigned to departments/shifts.

**Properties:**
- `id`: Unique identifier
- `template_id`: Source template
- `location_id`: Location where task is performed
- `area_id`: Optional specific area
- `department_id`: Department responsible
- `shift_id`: Shift responsible
- `due_at`: Due date/time
- `status`: Current status (pending, completed, skipped)
- `urgency_score`: Calculated urgency (0.0-1.0)
- `assigned_role`: Role assignment
- `window_start/window_end`: Time window for completion

**Key Features:**
- Always tied to a location
- Optionally tied to department and shift for better organization
- Includes urgency scoring for prioritization
- Visible to users assigned to the shift
- Managed in the **Task Instances** page

**Database Table:** `task_instances`

---

## User-Department-Shift Relationships

### User ↔ Departments
**Table:** `user_departments`

**Properties:**
- `user_id`: User reference
- `department_id`: Department reference
- `is_primary`: Boolean flag for primary department

**Key Features:**
- Many-to-many relationship (users can belong to multiple departments)
- One department marked as primary per user
- Managed in the **Team Management** (Users) page

---

### User ↔ Shifts
**Table:** `user_shifts`

**Properties:**
- `user_id`: User reference
- `shift_id`: Shift reference

**Key Features:**
- Many-to-many relationship (users can work multiple shifts)
- Determines which tasks are visible to which users
- Managed in the **Team Management** (Users) page

---

## User Workflows

### Creating Departments
1. Navigate to **Departments** page
2. Click **Create Department**
3. Enter department name and description
4. Save

### Creating Shifts
1. Navigate to **Departments** page
2. Find the department
3. Click **Add Shift** in the shift management section
4. Define shift name, start/end times, and days of week
5. Save

### Assigning Users to Departments/Shifts
1. Navigate to **Team Management** (Users) page
2. Invite or select a user
3. Assign to department (required during invitation)
4. Optionally assign to specific shifts within that department

### Creating Task Templates
1. Navigate to **Task Templates** page
2. Click **Create Template**
3. Fill in details including:
   - Title
   - **Department** (required)
   - Description, steps, estimated time
   - Criticality level
   - Required proof type
4. Save

### Creating Schedules (Recurring Tasks)
1. Navigate to **Schedules** page
2. Click **Create Schedule**
3. Follow the multi-step wizard:
   - **Step 1:** Select task template and optionally link department
   - **Step 2:** Choose schedule type (window, cron, one-off)
   - **Step 3:** Define timing (days/times for window, cron expression, or one-off date/time)
   - **Step 4:** Optionally link to a specific shift and assign to a role
4. Save

### Creating One-Off Tasks
1. Navigate to **Task Instances** page
2. Click **Create One-off Task**
3. Fill in:
   - Task template
   - Location and optional area
   - **Department** (optional - for better organization)
   - **Shift** (optional - if tied to a specific shift)
   - Due date/time
   - Optional role assignment
4. Save

---

## Task Assignment Logic

Tasks are assigned based on:
1. **Department linkage** - ensures correct scope of work
2. **Shift linkage** - ensures timing and responsibility alignment
3. **Role assignment** - tasks assigned to users with specific roles
4. **Location/Area** - defines where the work happens

**Example Flow:**
```
Kitchen Department → Morning Shift (08:00-16:00) 
   → Task Template "Clean Kitchen" 
   → Generates task "Clean Kitchen before 10:00 AM"
   → Visible to all users in Kitchen Department's Morning Shift
```

---

## Database Schema Summary

```
organizations
  └── departments
        ├── shifts
        │     └── user_shifts (users assigned to shifts)
        └── task_templates (department-specific templates)
              └── schedules (automation rules)
                    └── task_instances (actual work)

users (via profiles)
  ├── user_departments (department memberships)
  └── user_roles (role assignments)
```

---

## RLS (Row-Level Security) Policies

All tables have comprehensive RLS policies ensuring:
- Users can only see data from their organization
- Admins (org_admin, location_manager) can manage departments, shifts, templates, schedules
- Crew can view tasks assigned to them
- Proper data isolation between organizations

---

## API Integration Points

### Supabase Tables
- `departments` - CRUD operations for departments
- `shifts` - CRUD operations for shifts
- `user_departments` - User-department assignments
- `user_shifts` - User-shift assignments
- `task_templates` - Task blueprint management
- `schedules` - Schedule automation rules
- `task_instances` - Actual task execution tracking

### Edge Functions
- `materialize-tasks` - Generates task instances from schedules
- `update-urgency` - Calculates urgency scores for tasks
- `onboarding-assistant` - AI-powered onboarding flow

---

## Future Enhancements

Potential areas for expansion:
- Shift swapping functionality
- Advanced shift patterns (rotating schedules, split shifts)
- Department hierarchy (parent-child departments)
- Cross-department task assignment
- Shift-based analytics and reporting
- Mobile kiosk mode for shift-based task execution
- Real-time notifications for shift changes

---

## Best Practices

1. **Always assign departments to templates** - This is now required and ensures proper task organization
2. **Use shifts for time-sensitive tasks** - Link schedules to shifts when tasks must be completed within shift boundaries
3. **Leverage role-based assignment** - Use `assignee_role` for automatic task distribution
4. **Set primary departments** - Ensure each user has one primary department for default views
5. **Archive instead of delete** - Use `archived_at` for soft deletes to maintain historical data
6. **Monitor urgency scores** - Higher scores (closer to 1.0) indicate more urgent tasks

---

## Technical Notes

### Indexes
Performance indexes have been added on:
- `task_instances(department_id)`
- `task_instances(shift_id)`
- `user_departments(user_id, is_primary)`
- `user_shifts(user_id)`

### Migrations
The system was built incrementally with the following key migrations:
1. Initial departments and shifts tables creation
2. Junction tables for user-department and user-shift relationships
3. Department/shift columns added to task_templates, schedules, task_instances
4. Made department_id required in task_templates
5. Added performance indexes

---

This comprehensive system ensures that all work is properly scoped to departments, timed according to shifts, and assigned to the right people at the right time.
