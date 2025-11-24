/**
 * Parse Handlebars template to extract all variables
 */
export function parseHandlebarsVariables(template: string): string[] {
  const variables = new Set<string>()
  
  // Match simple variables like {{variable}} or {{object.property}}
  const simpleVarRegex = /\{\{([^{}#/!>]+?)\}\}/g
  let match
  
  while ((match = simpleVarRegex.exec(template)) !== null) {
    const varName = match[1].trim()
    // Skip helpers and special syntax
    if (!varName.includes('(') && 
        !varName.includes(')') && 
        !varName.startsWith('#') &&
        !varName.startsWith('/') &&
        !varName.startsWith('!') &&
        !varName.startsWith('>') &&
        !varName.startsWith('*') &&
        !varName.includes(' ') && // Skip expressions with spaces (like "eq orderType 'te'")
        varName !== 'this' &&
        varName !== 'else' &&
        !varName.startsWith('@') &&
        !varName.startsWith('../')) {
      variables.add(varName)
    }
  }
  
  // Also look for variables in block helpers like {{#if variable}} or {{#each items}}
  const blockVarRegex = /\{\{#(?:if|unless|each|with)\s+([^{}]+?)\}\}/g
  
  while ((match = blockVarRegex.exec(template)) !== null) {
    const varName = match[1].trim()
    // Skip complex expressions
    if (!varName.includes('(') && 
        !varName.includes(')') && 
        !varName.includes(' ') &&
        !varName.startsWith('../')) {
      variables.add(varName)
    }
  }
  
  return Array.from(variables).sort()
}

/**
 * Get all unique variable paths from template
 */
export function getVariablePaths(template: string): string[] {
  const paths = new Set<string>()
  const variables = parseHandlebarsVariables(template)
  
  variables.forEach(variable => {
    // Add the full path
    paths.add(variable)
    
    // Also add parent paths for nested properties
    const parts = variable.split('.')
    for (let i = 1; i < parts.length; i++) {
      paths.add(parts.slice(0, i).join('.'))
    }
  })
  
  return Array.from(paths).sort()
}

/**
 * Create a default data structure based on template variables
 */
export function createDefaultDataStructure(template: string): Record<string, any> {
  const variables = parseHandlebarsVariables(template)
  const data: Record<string, any> = {}
  
  variables.forEach(variable => {
    const parts = variable.split('.')
    let current = data
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      
      if (i === parts.length - 1) {
        // Last part - set a default value
        if (!current[part]) {
          // Try to guess the type based on the name
          if (part.toLowerCase().includes('date')) {
            current[part] = new Date().toISOString().split('T')[0]
          } else if (part.toLowerCase().includes('quantity') || 
                     part.toLowerCase().includes('number') || 
                     part.toLowerCase().includes('count')) {
            current[part] = 0
          } else if (part.toLowerCase().includes('required') || 
                     part.toLowerCase().includes('enabled') || 
                     part.toLowerCase().includes('active')) {
            current[part] = false
          } else {
            current[part] = ''
          }
        }
      } else {
        // Not the last part - create an object if needed
        if (!current[part]) {
          current[part] = {}
        }
        current = current[part]
      }
    }
  })
  
  return data
}