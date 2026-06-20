export interface RoleInfo {
  label:       string
  description: string
}

export const ROLE_DESCRIPTIONS: Record<string, RoleInfo> = {
  'database': {
    label: 'Database',
    description: 'Stores and retrieves persistent data for the system.',
  },
  'api-service': {
    label: 'API service',
    description: 'Handles requests and coordinates the business logic.',
  },
  'client': {
    label: 'Client',
    description: 'Where a user or another system initiates a request.',
  },
  'load-balancer': {
    label: 'Load balancer',
    description: 'Distributes incoming traffic across backend instances.',
  },
  'message-queue': {
    label: 'Message queue',
    description: 'Buffers messages between services so they don’t have to communicate directly in real time.',
  },
  'cache': {
    label: 'Cache',
    description: 'Stores frequently accessed data in memory for faster reads.',
  },
  'biological-unit': {
    label: 'Biological unit',
    description: 'A basic structural or functional unit within a living system.',
  },
  'brain-region': {
    label: 'Brain region',
    description: 'A distinct area of the brain associated with specific functions.',
  },
}

export const NO_ROLE_MESSAGE =
  'No automatic classification available for this node.'
