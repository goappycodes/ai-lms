import { bad, notFound, ok, parseBody, serverError } from "@/lib/api";
import { deleteQuiz, getLesson, getQuiz, upsertQuiz } from "@/lib/db/repo";
import { quizUpsert } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await getLesson(params.id))) return notFound("lesson not found");
    const quiz = await getQuiz(params.id);
    if (!quiz) return ok(null);
    return ok({
      ...quiz.quiz,
      questions: quiz.questions.map((q) => ({ ...q, options: JSON.parse(q.options) })),
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await getLesson(params.id))) return notFound("lesson not found");
    const parsed = await parseBody(req, quizUpsert);
    if ("error" in parsed) return parsed.error;
    // Validate correctIndex is within its options.
    for (const q of parsed.data.questions) {
      if (q.correctIndex >= q.options.length) return bad(`correctIndex out of range for "${q.prompt}"`);
    }
    const { quiz, questions } = await upsertQuiz(params.id, parsed.data);
    return ok({ ...quiz, questions: questions.map((q) => ({ ...q, options: JSON.parse(q.options) })) });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    return (await deleteQuiz(params.id)) ? ok({ deleted: true }) : notFound("quiz not found");
  } catch (e) {
    return serverError(e);
  }
}
