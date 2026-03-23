INSERT INTO public.organizations (id, name, timezone, settings)
VALUES ('00000000-0000-0000-0000-000000000000', 'Placeholder', 'UTC', '{}')
ON CONFLICT (id) DO NOTHING;