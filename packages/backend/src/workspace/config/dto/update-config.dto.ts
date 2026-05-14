export class UpdateConfigDto {
  /**
   * Slash commands configuration.
   * Array of { name, description, action } objects.
   */
  slashCommands?: Array<{ name: string; description: string; action: string }>;

  /**
   * Additional workspace metadata (arbitrary JSON).
   */
  metadata?: Record<string, unknown>;
}
