import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export const ACTIVITY_LOG_KEY = 'activityLog';

export interface ActivityLogOptions {
  /** Log only when this holds — e.g. not for a preview that changes nothing. */
  when?: (req: Request) => boolean;
  /** Leave the route out of the log entirely. */
  skip?: boolean;
}

/** Fine-tunes how a route is logged. Routes without it are logged as usual. */
export const LogActivity = (options: ActivityLogOptions) => SetMetadata(ACTIVITY_LOG_KEY, options);
