SELECT jsonb_build_object(
  'admin', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.admin AS t),
  'users', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.users AS t),
  'challenges', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.challenges AS t),
  'game_sessions', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.game_sessions AS t),
  'session_challenges', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.session_challenges AS t),
  'session_players', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.session_players AS t),
  'team_solutions', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.team_solutions AS t),
  'hint_usage', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.hint_usage AS t),
  'flag_attempts', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.flag_attempts AS t),
  'nemesis_state', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.nemesis_state AS t),
  'nemesis_log', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.nemesis_log AS t)
);
