import { NextResponse } from 'next/server'

const TASKS = new Set(['invoice-reminders', 'monthly-reports', 'project-maintenance'])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const secret = process.env.SCHEDULER_SECRET_KEY
  const auth = request.headers.get('authorization')
  const { taskId } = await params

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!TASKS.has(taskId)) {
    return NextResponse.json({ error: 'Unknown automation task' }, { status: 404 })
  }

  return NextResponse.json(
    {
      taskId,
      status: 'not_implemented',
      message: 'Automation endpoint is secured, but the task worker has not been implemented yet.',
    },
    { status: 501 }
  )
}