// Dashboard DTO for the commands module (shared by API and frontend; keep import-free).

export interface CommandEntry {
  /** Full path, e.g. `msg notes add`. */
  name: string;
  description: string;
  /** 0 = command, 1 = subcommand/group, 2 = subcommand in a group. */
  depth: number;
  /** Protected (`/commands`, `/configwizard`): always on. */
  locked: boolean;
  /** Effective state (also off when the category or a parent is off). */
  enabled: boolean;
  /** Turned off on its own (not only through its category or parent). */
  disabledDirectly: boolean;
}

export interface CommandCategory {
  key: string;
  name: string;
  icon: string;
  disabled: boolean;
  enabledCount: number;
  totalCount: number;
  commands: CommandEntry[];
}

export interface CommandsOverview {
  categories: CommandCategory[];
  enabledTotal: number;
  totalCommands: number;
}
