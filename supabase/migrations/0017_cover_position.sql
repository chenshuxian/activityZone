-- banner 呈現的垂直焦點（0=靠上, 50=置中, 100=靠下），避免封面被去頭去尾
alter table public.events
  add column cover_position smallint not null default 50
  check (cover_position between 0 and 100);
