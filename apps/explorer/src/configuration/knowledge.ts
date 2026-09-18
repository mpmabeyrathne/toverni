import {
    resolve,
  } from 'node:path';
  
  import {
    fileURLToPath,
  } from 'node:url';
  
  export interface KnowledgeConfiguration {
    requirementsPath?:
      string;
  
    openApiPath?:
      string;
  }
  
  const projectRoot =
    fileURLToPath(
      new URL(
        '../../../../',
        import.meta.url,
      ),
    );
  
  function resolveOptionalPath(
    value:
      | string
      | undefined,
  ): string | undefined {
    if (
      !value ||
      value.trim() === ''
    ) {
      return undefined;
    }
  
    return resolve(
      projectRoot,
      value,
    );
  }
  
  export function getKnowledgeConfiguration():
    KnowledgeConfiguration {
    const requirementsPath =
      resolveOptionalPath(
        process.env.REQUIREMENTS_PATH,
      );
  
    const openApiPath =
      resolveOptionalPath(
        process.env.OPENAPI_PATH,
      );
  
    return {
      ...(requirementsPath
        ? {
            requirementsPath,
          }
        : {}),
  
      ...(openApiPath
        ? {
            openApiPath,
          }
        : {}),
  
    };
  }