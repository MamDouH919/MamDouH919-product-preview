export enum Action {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  /** Signing off a money action someone else may not make alone (voiding a collection, approving a refund). */
  APPROVE = 'approve',
  /** Asking for a money action someone else may need to approve (a refund). */
  REQUEST = 'request',
  /** Carrying out an approved money action (paying a refund out). */
  EXECUTE = 'execute',
}