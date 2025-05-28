/**
 * This module defines error codes for logging purposes.
 * Each error code includes a message, description, and additional fields for context.
 * The structure is designed to be used with a logging system that can interpret these codes.
 */
export const LOG_CODES = {
  fatal: {
    CONFIG_ENV_PARSE_ERROR: {
      message: 'Environment configuration parse error',
      description:
        'An error occurred while parsing the environment configuration. This may be due to invalid JSON format or unexpected data types.',
      additionalFields: {
        envName: 'The name of the environment variable that caused the error.',
        errorMessage: 'The error message describing the parsing issue.',
      },
    },
    CONFIG_FILE_NOT_FOUND: {
      message: 'Configuration file not found',
      description:
        'The specified configuration file could not be found. Please ensure the file exists at the specified path.',
      additionalFields: {
        fileName: 'The path to the configuration file that was not found.',
      },
    },
    CONFIG_FILE_PARSE_ERROR: {
      message: 'Configuration file parse error',
      description:
        'An error occurred while parsing the configuration file. This may be due to invalid JSON format or unexpected data types.',
      additionalFields: {
        fileName: 'The path to the configuration file that caused the error.',
        errorMessage: 'The error message describing the parsing issue.',
      },
    },
    INITIALIZATION_ERROR: {
      message: 'Initialization error',
      description:
        'An error occurred during the initialization phase of the application. This may be due to configuration issues or missing dependencies.',
      additionalFields: {
        errorMessage:
          'This is the message passed up from the lower level error object.',
      },
    },
    LOG_LEVEL_INVALID: {
      message: 'Invalid log level',
      description:
        'The provided log level is not recognized. Valid levels are: debug, info, warn, error, fatal.',
      additionalFields: {
        logLevel: 'The log level that was attempted to be set.',
      },
    },
    UNKNOWN_GLOBAL_ERROR: {
      message: 'Unknown global error',
      description:
        'An unexpected error occurred that was not handled by the application. This may indicate a bug or an unhandled exception.',
      additionalFields: {
        err: 'The error object containing details about the unexpected error.',
      },
    },
  },
  error: {
    UNHANDLED_REJECTION: {
      message: 'Unhandled promise rejection',
      description:
        'A JavaScript promise was rejected but no error handler was attached to handle the rejection. This should never happen and should be reported as a bug.',
      additionalFields: {
        err: 'The error object containing details about the unhandled rejection.',
      },
    },
  },
} as const;
