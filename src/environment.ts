class EnvironmentClass {
  public readonly discordToken: string = this.getEnvVar('DISCORD_TOKEN');
  public readonly setupChannelId: string = this.getEnvVar('SETUP_CHANNEL_ID');
  public readonly databasePath: string = this.getEnvVar('DATABASE_PATH');

  private getEnvVar(varName: string, defaultValue?: string) {
    const value = process.env[varName];
    if (value) return value;
    if (defaultValue) return defaultValue;
    throw new Error(`${varName} environment variable is not set.`);
  }
}

export const Environment = new EnvironmentClass();