import { useEffect, useMemo, useState, type FormEvent } from "react"
import { AlertCircle, BookOpen, BrainCircuit, Check, ChevronDown, ExternalLink, Plus, RotateCcw, Target, Trash2, TrendingUp } from "lucide-react"
import { Badge, Button, Card, Field, PageTitle, Progress, Select, Textarea } from "../../components/ui"
import { trainingService } from "./trainingService"
import type { Analysis, Mastery, ProgressItem, Recommendation, Result, Session } from "./types"

const STORAGE_KEY = "jobora.training.plan"
const message = (error: unknown) => error instanceof Error ? error.message : "Une erreur inattendue est survenue."

export default function TrainingPage() {
  const [skills, setSkills] = useState<string[]>([]); const [draft, setDraft] = useState("")
  const [job, setJob] = useState(""); const [goal, setGoal] = useState("")
  const [analysis, setAnalysis] = useState<Analysis|null>(null); const [progress, setProgress] = useState<Record<string,ProgressItem>>({})
  const [loading, setLoading] = useState(false); const [error, setError] = useState("")
  useEffect(() => { const id=localStorage.getItem(STORAGE_KEY); if (!id) return; trainingService.plan(id).then((plan) => {
    if (plan.content.gaps && plan.content.roadmap) setAnalysis({ plan_id:plan.id, gaps:plan.content.gaps, roadmap:plan.content.roadmap,
      resources:plan.content.resources||[], provenance:{provider:"groq",model:plan.model_name||"unknown"}, created_at:plan.created_at })
    setProgress(Object.fromEntries(plan.progress.map((item)=>[item.task_id,item])))
  }).catch(()=>localStorage.removeItem(STORAGE_KEY)) }, [])
  const tasks=analysis?.roadmap.weeks.flatMap((week)=>week.tasks)||[]; const completed=tasks.filter((task)=>progress[task.id]?.status==="completed").length
  const counts=useMemo(()=>analysis?.gaps.reduce<Record<string,number>>((all,gap)=>({...all,[gap.status]:(all[gap.status]||0)+1}),{})||{},[analysis])
  function addSkill(){const value=draft.trim();if(value&&!skills.some((x)=>x.toLowerCase()===value.toLowerCase()))setSkills([...skills,value]);setDraft("")}
  async function submit(event:FormEvent){event.preventDefault();setError("");if(!skills.length||job.trim().length<20||goal.trim().length<2){setError("Ajoute une compétence, une offre complète et ton objectif.");return}setLoading(true);try{
    const result=await trainingService.analyze({candidate_skills:skills.map((name)=>({name,level:"unknown",evidence:[]})),job_description:job,career_goal:goal,current_level:"beginner",weekly_hours:5,target_weeks:4,preferred_language:"fr",free_only:true})
    setAnalysis(result);setProgress({});localStorage.setItem(STORAGE_KEY,result.plan_id)
  }catch(e){setError(message(e))}finally{setLoading(false)}}
  async function toggle(id:string){if(!analysis)return;const done=progress[id]?.status==="completed";try{const saved=await trainingService.progress(analysis.plan_id,id,{status:done?"not_started":"completed",completion_percent:done?0:100,minutes_spent:progress[id]?.minutes_spent||0,evidence_note:null});setProgress((p)=>({...p,[id]:saved}))}catch(e){setError(message(e))}}
  return <><PageTitle eyebrow="Module 5 · Formations" title="Ta roadmap personnalisée" description="Analyse tes écarts, progresse et vérifie tes acquis." />
    <Card className="roadmap"><div className="card-heading"><div><Badge tone="ai">Analyse JOBORA</Badge><h2>Comparer mon profil à l'offre</h2><p>Les données restent liées à ton compte authentifié.</p></div><Target size={24}/></div>
      <form onSubmit={submit}><div className="form-grid"><Field label="Compétence" value={draft} onChange={(e)=>setDraft(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();addSkill()}}}/><Button type="button" variant="secondary" onClick={addSkill}><Plus size={16}/>Ajouter</Button></div>
      <div className="training-tags">{skills.map((skill)=><span key={skill}><strong>{skill}</strong><button type="button" onClick={()=>setSkills(skills.filter((x)=>x!==skill))}><Trash2 size={13}/></button></span>)}</div>
      <Textarea label="Offre d'emploi" rows={7} value={job} onChange={(e)=>setJob(e.target.value)}/><Textarea label="Objectif professionnel" rows={3} value={goal} onChange={(e)=>setGoal(e.target.value)}/>
      <Button type="submit" variant="ai" loading={loading}>Analyser et générer ma roadmap</Button></form></Card>
    {error&&<div className="training-alert" role="alert"><AlertCircle size={18}/>{error}</div>}
    {analysis&&<><div className="training-summary">{[["matched","Maîtrisées"],["partial","Partielles"],["missing","Manquantes"]].map(([key,label])=><Card key={key}><strong>{counts[key]||0}</strong><span>{label}</span></Card>)}</div>
      <Card className="roadmap"><div className="card-heading"><div><Badge tone="ai">Roadmap personnalisée</Badge><h2>{analysis.roadmap.title}</h2><p>{analysis.roadmap.summary}</p></div><Progress value={tasks.length?Math.round(completed/tasks.length*100):0} label={`${completed}/${tasks.length}`}/></div>
      <div className="training-weeks">{analysis.roadmap.weeks.map((week,index)=><details key={week.week} open={index===0}><summary><span>Semaine {week.week}</span><strong>{week.title}</strong><ChevronDown size={18}/></summary><div>{week.tasks.map((task)=><article className={progress[task.id]?.status==="completed"?"done":""} key={task.id}><button className="task-check" onClick={()=>toggle(task.id)}>{progress[task.id]?.status==="completed"?<Check size={16}/>:null}</button><div><h3>{task.title}</h3><p>{task.objective}</p><strong>Exercice</strong><p>{task.exercise}</p></div></article>)}</div></details>)}</div></Card>
      <Assessment planId={analysis.plan_id} skills={analysis.gaps.map((g)=>g.skill)}/>
      <Card className="roadmap"><div className="card-heading"><div><h2>Ressources vérifiées</h2><p>Catalogue pédagogique conservé.</p></div><BookOpen size={22}/></div><div className="resource-list">{analysis.resources.map((resource)=><a key={resource.id} href={resource.url} target="_blank" rel="noreferrer"><strong>{resource.title}</strong><span>{resource.provider}</span><ExternalLink size={15}/></a>)}</div></Card></>}
  </>
}

function Assessment({planId,skills}:{planId:string;skills:string[]}){
  const supported=["Git","Docker","Flutter","Firebase","CI-CD"];const available=supported.filter((s)=>skills.some((x)=>x.toLowerCase().includes(s.toLowerCase())));const options=available.length?available:supported
  const [skill,setSkill]=useState(options[0]);const [session,setSession]=useState<Session|null>(null);const [answers,setAnswers]=useState<Record<string,number>>({});const [result,setResult]=useState<Result|null>(null)
  const [history,setHistory]=useState<Mastery[]>([]);const [recommendations,setRecommendations]=useState<Recommendation[]>([]);const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [stale,setStale]=useState(false)
  async function refresh(){try{const[h,r]=await Promise.all([trainingService.mastery(),trainingService.recommendations()]);setHistory(h);setRecommendations(r);setStale(false)}catch(e){setError(`Données adaptatives non actualisées : ${message(e)}`);setStale(true)}}
  useEffect(()=>{void refresh()},[])
  async function start(){setBusy(true);setError("");setResult(null);setAnswers({});try{setSession(await trainingService.assessment(skill,planId))}catch(e){setError(message(e))}finally{setBusy(false)}}
  async function submit(){if(!session)return;setBusy(true);try{setResult(await trainingService.submit(session.id,session.questions.map((q)=>({question_id:q.id,selected_choice:answers[q.id]}))));await refresh()}catch(e){setError(message(e))}finally{setBusy(false)}}
  const latest=[...history].reverse().filter((x,i,a)=>a.findIndex((y)=>y.concept_id===x.concept_id)===i)
  return <Card className="roadmap"><div className="card-heading"><div><Badge tone="teal">BKT</Badge><h2>Évaluation adaptative</h2><p>Questions approuvées uniquement · estimation, pas certification.</p></div><BrainCircuit size={24}/></div>
    <div className="form-grid"><Select label="Compétence" value={skill} onChange={(e)=>setSkill(e.target.value)}>{options.map((x)=><option key={x}>{x}</option>)}</Select><Button variant="ai" loading={busy} onClick={start}>{session?"Nouvelle tentative":"Commencer"}</Button></div>
    {error&&<div className="training-alert"><AlertCircle size={17}/><span>{error}{stale?" · Les dernières données restent affichées.":""}</span>{stale&&<Button variant="ghost" onClick={refresh}><RotateCcw size={14}/>Réessayer</Button>}</div>}
    {session&&!result&&<div className="quiz-card">{session.questions.map((q,i)=><fieldset key={q.id}><legend>{i+1}. {q.prompt}</legend>{q.choices.map((c,j)=><label key={c}><input type="radio" name={q.id} checked={answers[q.id]===j} onChange={()=>setAnswers({...answers,[q.id]:j})}/>{c}</label>)}</fieldset>)}<Button disabled={Object.keys(answers).length!==session.questions.length} loading={busy} onClick={submit}>Soumettre</Button></div>}
    {result&&<div className="score-card"><strong>{result.score}/{result.total}</strong><div>{result.results.map((x)=><p key={x.question_id}>{x.correct?"✓":"✗"} {x.explanation} · maîtrise {Math.round(x.mastery*100)} %</p>)}</div></div>}
    {!!latest.length&&<div><h3><TrendingUp size={17}/> Progression</h3>{latest.map((x)=><Progress key={x.concept_id} value={Math.round(x.mastery*100)} label={`${x.skill} · ${Math.round(x.mastery*100)} %`}/>)}</div>}
    {!!recommendations.length&&<div className="next-actions">{recommendations.slice(0,4).map((x)=><article key={x.concept_id}><Badge>{x.action.replace(/_/g," ")}</Badge><p>{x.rationale}</p></article>)}</div>}
  </Card>
}
