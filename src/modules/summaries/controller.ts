import { Request, Response } from 'express'
import * as service from './service'
import { generateSummaryPdf } from './pdf'

export const createManual = async (req: Request, res: Response) => {
  try {
    const summary = await service.createSummaryManual(req.body)
    res.status(201).json({ success: true, data: summary })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export const createAuto = async (req: Request, res: Response) => {
  try {
    const clientId = req.params.clientId as string
    const summary = await service.createSummaryAuto(clientId, req.body)
    res.status(201).json({ success: true, data: summary })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export const preview = async (req: Request, res: Response) => {
  try {
    const clientId = req.params.clientId as string
    const referenceDate = req.query.date as string | undefined
    const data = await service.previewBillingPeriod(clientId, referenceDate)
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export const getByClient = async (req: Request, res: Response) => {
  try {
    const clientId = req.params.clientId as string
    const summaries = await service.getAllByClient(clientId)
    res.json({ success: true, data: summaries })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const summary = await service.getById(id)
    res.json({ success: true, data: summary })
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message })
  }
}

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const summary = await service.updateStatus(id, req.body)
    res.json({ success: true, data: summary })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export const getPdf = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const summary = await service.getById(id)
    const pdfBuffer = await generateSummaryPdf(summary)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="resumen-${id}.pdf"`
    )
    res.send(pdfBuffer)
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    await service.deleteSummary(id)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}