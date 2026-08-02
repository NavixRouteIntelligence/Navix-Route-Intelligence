import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Claim global e atómico da outbox, sem varrer todos os tenants (ADR-0094). */
export class WebhookClaim1720003700000 implements MigrationInterface {
  name = 'WebhookClaim1720003700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    // SKIP LOCKED permite várias réplicas sem duplicar o envio. SECURITY DEFINER
    // é necessário porque o worker ainda não conhece o tenant; a função tem SQL
    // fixo, não recebe fragmentos e só devolve a linha que já reivindicou.
    await queryRunner.query(`
      CREATE FUNCTION claim_webhook_delivery()
      RETURNS TABLE (
        id uuid,
        tenant_id uuid,
        event_type varchar,
        payload jsonb,
        attempts integer,
        url text,
        encrypted_secret text
      )
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = pg_catalog, public
      AS $$
        WITH candidate AS MATERIALIZED (
          SELECT d.id
            FROM public.webhook_deliveries d
            JOIN public.webhook_subscriptions s ON s.id = d.subscription_id
           WHERE d.status IN ('pending', 'delivering')
             AND d.next_attempt_at <= now()
             AND s.enabled = true
           ORDER BY d.created_at
           FOR UPDATE OF d SKIP LOCKED
           LIMIT 1
        ), claimed AS (
          UPDATE public.webhook_deliveries d
             SET status = 'delivering',
                 attempts = d.attempts + 1,
                 next_attempt_at = now() + interval '60 seconds'
            FROM candidate c
           WHERE d.id = c.id
          RETURNING d.id, d.tenant_id, d.event_type, d.payload,
                    d.attempts, d.subscription_id
        )
        SELECT c.id, c.tenant_id, c.event_type, c.payload, c.attempts,
               s.url, s.encrypted_secret
          FROM claimed c
          JOIN public.webhook_subscriptions s ON s.id = c.subscription_id;
      $$;
    `);
    await queryRunner.query(`REVOKE ALL ON FUNCTION claim_webhook_delivery() FROM PUBLIC;`);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION claim_webhook_delivery() TO ${appUser};`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS claim_webhook_delivery();`);
  }
}
