declare namespace NodeJS {
  interface ProcessEnv {
    // Build configuration
    NODE_ENV: 'development' | 'production'
    SINGLE_FILE_BUILD?: string
    DISABLE_SERVICE_WORKER?: string
    CONFIG_JSON_SOURCE?: 'BUNDLED' | 'REMOTE'
    LOCAL_CONFIG_FILE?: string
    BUILD_VERSION?: string

    // GitHub and Vercel related
    GITHUB_REPOSITORY?: string
    VERCEL_GIT_REPO_OWNER?: string
    VERCEL_GIT_REPO_SLUG?: string

    // UI and Features
    MAIN_MENU_LINKS?: string
    ENABLE_COOKIE_STORAGE?: string
    COOKIE_STORAGE_PREFIX?: string

    // Release information
    RELEASE_TAG?: string
    RELEASE_LINK?: string
    RELEASE_CHANGELOG?: string

    // Other configurations
    DEPS_VERSIONS?: string
    INLINED_APP_CONFIG?: string
  }
}
