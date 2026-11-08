import { Controller, Get } from '@nestjs/common';
import { FeedService } from './feed.service';

/** Public. Read by the storefront's product feeds (Google Merchant Center) on the server. */
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('products')
  products() {
    return this.feedService.products();
  }
}
