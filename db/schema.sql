create table if not exists admin (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      varchar(64) not null unique,
  password_hash varchar(255) not null,
  created_at    TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  team_name     varchar(128) not null,
  username      varchar(64) not null unique,
  password_hash varchar(255) not null,
  color         char(7) not null default '#d86e33',
  role          varchar(20) not null default 'player'
                  constraint ck_users_role check (role in ('player', 'referente')),
  created_at    TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists idx_users_username on users (username);

create table if not exists challenges (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            varchar(16) not null unique,
  title           varchar(128) not null,
  category        TEXT not null,
  difficulty      TEXT not null,
  base_points     smallint not null,
  description     text not null,
  terminal_block  text null,
  flag_hash       varchar(64) not null,
  attachment_path varchar(255) null,
  attachment_name varchar(128) null,
  hint1_text      varchar(512) null,
  hint2_text      varchar(512) null,
  hint3_text      varchar(512) null,
  is_active       boolean not null default true,
  created_at      TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  constraint ck_challenges_base_points check (base_points in (5, 6, 7, 8, 10, 12))
);
create index if not exists idx_challenges_category on challenges (category);
create index if not exists idx_challenges_difficulty on challenges (difficulty);

create table if not exists game_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          varchar(128) not null,
  game_code     varchar(32) not null unique,
  mode          TEXT not null default 'coop',
  duration_mins integer not null default 90,
  status        TEXT not null default 'pending',
  started_at    TEXT null,
  ended_at      TEXT null,
  admin_notes   text null,
  created_at    TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  constraint ck_game_sessions_duration_mins check (duration_mins > 0)
);
create index if not exists idx_game_sessions_status on game_sessions (status);
create index if not exists idx_game_sessions_game_code on game_sessions (game_code);

create table if not exists session_challenges (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     integer not null references game_sessions(id) on delete cascade,
  challenge_id   integer not null references challenges(id) on delete restrict,
  is_solved      boolean not null default false,
  solved_at      TEXT null,
  solved_by_team integer null references users(id) on delete set null,
  created_at     TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unique (session_id, challenge_id)
);
create index if not exists idx_session_challenges_session_id on session_challenges (session_id);

create table if not exists session_players (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   integer not null references game_sessions(id) on delete cascade,
  user_id      integer not null references users(id) on delete cascade,
  status       TEXT not null default 'offline',
  score        integer not null default 0,
  joined_at    TEXT null,
  last_seen_at TEXT null,
  unique (session_id, user_id)
);
create index if not exists idx_session_players_session_id on session_players (session_id);
create index if not exists idx_session_players_user_id on session_players (user_id);

create table if not exists team_solutions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    integer not null references game_sessions(id) on delete cascade,
  user_id       integer not null references users(id) on delete cascade,
  challenge_id  integer not null references challenges(id) on delete restrict,
  points_awarded smallint not null,
  attempts      integer not null default 1,
  solved_at     TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unique (session_id, user_id, challenge_id)
);
create index if not exists idx_team_solutions_session_id on team_solutions (session_id);
create index if not exists idx_team_solutions_user_id on team_solutions (user_id);
create index if not exists idx_team_solutions_challenge_id on team_solutions (challenge_id);

create table if not exists hint_usage (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   integer not null references game_sessions(id) on delete cascade,
  user_id      integer not null references users(id) on delete cascade,
  challenge_id integer not null references challenges(id) on delete restrict,
  hint_number  smallint not null,
  cost_points  smallint not null,
  used_at      TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unique (session_id, user_id, challenge_id, hint_number),
  constraint ck_hint_usage_hint_number check (hint_number in (1, 2, 3))
);
create index if not exists idx_hint_usage_session_id on hint_usage (session_id);
create index if not exists idx_hint_usage_user_id on hint_usage (user_id);

create table if not exists flag_attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    integer not null references game_sessions(id) on delete cascade,
  user_id       integer not null references users(id) on delete cascade,
  challenge_id  integer not null references challenges(id) on delete restrict,
  submitted_hash varchar(64) not null,
  is_correct    boolean not null default false,
  attempted_at  TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists idx_flag_attempts_session_id on flag_attempts (session_id);
create index if not exists idx_flag_attempts_user_id_challenge_id on flag_attempts (user_id, challenge_id);
create index if not exists idx_flag_attempts_attempted_at on flag_attempts (attempted_at);

create table if not exists nemesis_state (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      integer not null unique references game_sessions(id) on delete cascade,
  integrity_pct   smallint not null default 100,
  emotional_state TEXT not null default 'dominant',
  last_message    text null,
  selected_team   integer null references users(id) on delete set null,
  updated_at      TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists nemesis_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      integer not null references game_sessions(id) on delete cascade,
  event_type      varchar(64) not null,
  trigger_user_id integer null references users(id) on delete set null,
  trigger_ch_id   integer null references challenges(id) on delete set null,
  prev_state      varchar(32) null,
  new_state       varchar(32) null,
  prev_integrity  smallint null,
  new_integrity   smallint null,
  message         text null,
  created_at      TEXT not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists idx_nemesis_log_session_id on nemesis_log (session_id);
create index if not exists idx_nemesis_log_created_at on nemesis_log (created_at);

CREATE TABLE access_tokens (
 digest TEXT PRIMARY KEY, user_id INTEGER NOT NULL, role TEXT NOT NULL,
 session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX token_expiration ON access_tokens(expires_at);
