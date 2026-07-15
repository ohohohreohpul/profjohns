# Backup and Recovery (OPS-003)

## Database Backup

### Schedule
- **Automated daily backups**: Supabase Pro plan includes daily automated
  backups of the entire database (7-day retention).
- **Point-in-time recovery (PITR)**: Supabase PITR add-on provides
  recovery to any point within the last 7 days (Pro) or 30 days (Enterprise).
- **Manual backups**: Before any migration, take a manual backup:
  ```bash
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
  ```

### Verification
- Weekly: verify the latest automated backup exists in Supabase dashboard
- Monthly: perform a staging restore drill (see below)

## Storage Backup

### Strategy
- Supabase Storage objects are backed up independently from the database.
- The `media` bucket (user uploads) is included in Supabase's storage backups.
- For additional safety, critical files can be replicated to an S3 bucket
  via a scheduled job.

### Verification
- Weekly: verify storage backup exists and object count matches

## User-Level Restore

### Procedure
1. Identify the user's UUID from `auth.users`
2. Restore from PITR to a new branch (Supabase branching)
3. Export the user's data:
   ```sql
   SELECT * FROM public.projects WHERE user_id = '<uuid>';
   SELECT * FROM public.canvases WHERE user_id = '<uuid>';
   SELECT * FROM public.sources WHERE user_id = '<uuid>';
   -- ... etc for all user-owned tables
   ```
4. Insert the exported data into the production database
5. Verify with the user that their data is restored

## Accidental Deletion Recovery

### Database records
- Use PITR to recover to a point before the deletion
- Export affected records from the PITR branch
- Insert them back into production

### Storage objects
- If using S3 replication, restore from S3
- If not replicated, objects may be permanently lost (document this risk)

## Migration Rollback

### Before migration
1. Take a full database backup: `pg_dump`
2. Record the current migration version
3. Document the rollback procedure

### Rollback procedure
1. Restore from the pre-migration backup
2. Or: write a reverse migration that undoes the changes
3. Verify row counts and foreign-key integrity

### Rollback verification
```sql
SELECT count(*) FROM public.projects;
SELECT count(*) FROM public.canvases;
SELECT count(*) FROM public.sources;
SELECT count(*) FROM public.agents;
SELECT count(*) FROM public.standing_tasks;
SELECT count(*) FROM public.findings;
SELECT count(*) FROM public.figures;
```

## Staging Restore Drill

### Monthly procedure
1. Create a fresh staging database from the latest production backup
2. Verify all tables are present and populated
3. Verify RLS policies are active
4. Run the multi-user isolation test suite against the restored database
5. Verify a sample user can log in and see their data
6. Document: drill date, backup date, results, any issues found

## Incident Response

### Contacts
- **Primary**: [To be filled with team lead contact]
- **Secondary**: [To be filled with on-call contact]
- **Supabase support**: support@supabase.com (Pro plan)

### Severity levels
- **Critical**: Data loss, auth failure, or vendor key exposure
  → Page on-call, start incident channel, notify users
- **Major**: Feature unavailable, sync failures
  → Investigate within 1 hour, status page update
- **Minor**: Non-critical bugs, UI issues
  → Fix in next deployment

### Incident checklist
1. Acknowledge the incident
2. Identify scope (which users, which features)
3. Check Supabase status page (status.supabase.com)
4. Check vendor status pages (OpenRouter, Replicate)
5. Review logs for errors
6. Apply fix or rollback
7. Verify recovery
8. Post-incident review (within 48 hours)
