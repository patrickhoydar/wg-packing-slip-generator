# Improve PDF generation speed and performance

PDF generation seems to take a lot longer than another service we use to generate hundereds of PDFs. 

Outline of the other Service
  Architecture: Uses Puppeteer (HTML-to-PDF) + pdf-lib (PDF manipulation) with a persistent browser instance.

  Generation Flow:
  1. Pre-initialization: Compiles Handlebars templates, loads CSS, base64-encodes logos
  2. Template Processing: Injects data into pre-compiled templates
  3. PDF Conversion: Puppeteer renders HTML to PDF via headless Chrome
  4. Merging: pdf-lib combines multiple PDFs sequentially

  Performance Optimizations:
  - Browser Reuse: Single persistent browser instance across all generations
  - Concurrency Control: Queue-based limiter (5 concurrent PDFs)
  - Asset Pre-loading: Templates, CSS, and logos cached in memory
  - Parallel Batch Processing: Processes multiple PDFs simultaneously

  Key Performance Factors:
  - Fast: Pre-compiled templates eliminate compilation overhead
  - Efficient: Base64-encoded assets reduce external dependencies
  - Scalable: Concurrency limits prevent resource exhaustion
  - Optimized: Headless Chrome with security flags for container compatibility

  Bottlenecks:
  - Sequential PDF merging (no parallel processing)
  - Fixed concurrency limit (5) may not scale with available resources
  - Memory usage grows with batch size (no streaming)
