CREATE TABLE public.mock_agent_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mock_agent_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.mock_agent_config (id, mode) VALUES (1, 'success');