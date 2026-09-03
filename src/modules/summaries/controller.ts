import { Response } from 'express'
import * as service from './service'
import { generateSummaryPdf } from './pdf'
import { AuthRequest } from '../../middlewares/verifyToken'
import { getClientAccessLevel } from '../../utils/calendarAuth'

export const createManual = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    const summary = await service.createSummaryManual(req.body, req.user)
    res.status(201).json({ success: true, data: summary })
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ success: false, message: error.message })
  }
}

export const createAuto = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.params.clientId as string
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    const summary = await service.createSummaryAuto(clientId, req.body, req.user)
    res.status(201).json({ success: true, data: summary })
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ success: false, message: error.message })
  }
}

export const preview = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.params.clientId as string
    const referenceDate = req.query.date as string | undefined
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    const data = await service.previewBillingPeriod(clientId, referenceDate, req.user)
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ success: false, message: error.message })
  }
}

export const getByClient = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.params.clientId as string
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado' })
    }

    if ((await getClientAccessLevel(req.user, BigInt(clientId))) === 'none') {
      return res.status(403).json({ success: false, message: 'No tienes acceso a este cliente' })
    }

    const summaries = await service.getAllByClient(clientId, req.user)
    res.json({ success: true, data: summaries })
  } catch (error: any) {
    res.status(error?.statusCode ?? 500).json({ success: false, message: error.message })
  }
}

export const getById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado' })
    }

    const id = req.params.id as string
    const summary = await service.getById(id, req.user)

    if ((await getClientAccessLevel(req.user, summary.client_id)) === 'none') {
      return res.status(403).json({ success: false, message: 'No tienes acceso a este resumen' })
    }

    res.json({ success: true, data: summary })
  } catch (error: any) {
    res.status(error?.statusCode ?? 404).json({ success: false, message: error.message })
  }
}

export const updateStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    const id = req.params.id as string
    const summary = await service.updateStatus(id, req.body, req.user)
    res.json({ success: true, data: summary })
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ success: false, message: error.message })
  }
}

export const paySummary = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    const id = req.params.id as string
    const summary = await service.paySummary(id, req.body, req.user)
    res.json({ success: true, data: summary })
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ success: false, message: error.message })
  }
}

export const reportPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    const summary = await service.reportPayment(req.params.id as string, req.user)
    res.json({ success: true, data: summary })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export const confirmPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    const summary = await service.confirmPayment(req.params.id as string, req.body, req.user)
    res.json({ success: true, data: summary })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export const rejectPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    const summary = await service.rejectPayment(req.params.id as string, req.user)
    res.json({ success: true, data: summary })
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ success: false, message: error.message })
  }
}

export const getPdf = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado' })
    }

    const id = req.params.id as string
    const summary = await service.getById(id, req.user)

    if ((await getClientAccessLevel(req.user, summary.client_id)) === 'none') {
      return res.status(403).json({ success: false, message: 'No tienes acceso a este resumen' })
    }

    const pdfBuffer = await generateSummaryPdf(summary)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="resumen-${id}.pdf"`
    )
    res.send(pdfBuffer)
  } catch (error: any) {
    res.status(error?.statusCode ?? 500).json({ success: false, message: error.message })
  }
}

export const remove = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    await service.deleteSummary(id, req.user)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ success: false, message: error.message })
  }
}
