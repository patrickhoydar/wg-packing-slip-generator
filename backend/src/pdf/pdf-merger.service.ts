import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class PdfMergerService {
  private readonly logger = new Logger(PdfMergerService.name);

  async mergePdfs(pdfFilePaths: string[]): Promise<Buffer> {
    if (pdfFilePaths.length === 0) {
      throw new Error('No PDF files provided for merging');
    }

    this.logger.log(`Starting PDF merge for ${pdfFilePaths.length} files`);

    try {
      // Create a new PDF document
      const mergedPdf = await PDFDocument.create();

      // Sort files to ensure consistent order
      const sortedFiles = pdfFilePaths.sort((a, b) => {
        const aName = path.basename(a);
        const bName = path.basename(b);
        return aName.localeCompare(bName, undefined, { numeric: true });
      });

      // Iterate over each file and merge its pages into the new document
      for (const filePath of sortedFiles) {
        const fileData = await fs.readFile(filePath);
        this.logger.log(`Processing file: ${path.basename(filePath)}`);

        // Load the current PDF
        const pdfToMerge = await PDFDocument.load(fileData);
        const pages = await mergedPdf.copyPages(pdfToMerge, pdfToMerge.getPageIndices());

        // Add the pages to the merged document
        pages.forEach((page) => mergedPdf.addPage(page));
      }

      // Serialize the merged document to bytes
      const mergedPdfBytes = await mergedPdf.save();
      this.logger.log(`Successfully merged ${sortedFiles.length} PDFs`);

      return Buffer.from(mergedPdfBytes);
    } catch (error) {
      this.logger.error(`Error merging PDFs: ${error.message}`);
      throw error;
    }
  }

  async mergePdfsFromDirectory(directoryPath: string): Promise<Buffer> {
    try {
      const files = await fs.readdir(directoryPath);
      const pdfFiles = files
        .filter(file => file.endsWith('.pdf'))
        .map(file => path.join(directoryPath, file));

      if (pdfFiles.length === 0) {
        throw new Error(`No PDF files found in directory: ${directoryPath}`);
      }

      return await this.mergePdfs(pdfFiles);
    } catch (error) {
      this.logger.error(`Error processing directory ${directoryPath}: ${error.message}`);
      throw error;
    }
  }
}