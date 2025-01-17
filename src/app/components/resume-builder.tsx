/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, FileText, Plus, Save, AlertCircle } from 'lucide-react'
import PersonalInformationSection from './personal-information-section'
import ProfessionalSummarySection from './professional-summary-section'
import ExperienceSection from './experience-section'
import EducationSection from './education-section'
import ProjectsSection from './projects-section'
import CertificatesSection from './certificates-section'
import CustomSection from './custom-section'
import SkillsSection from './skills-section'
import ATSResume from './ats-resume'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { useToast } from './ui/use-toast'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Progress } from './ui/progress'

declare global {
  interface Window {
    gtag_report_conversion: (url?: string) => boolean;
  }
}

// Define the structure for resume data
export interface ResumeData {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
  };
  professionalSummary: string;
  experience: any[];
  education: Education[];
  projects: { id: string; name: string; description: string }[];
  certificates: Certificate[];
  customSections: CustomSection[];
  skills: { id: string; name: string }[];
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  graduationDate: string;
}

export interface CustomSection {
  id: string;
  title: string;
  items: string[];
}

// Define the structure for a certificate
export interface Certificate {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
}

// Define the structure for a saved resume
interface SavedResume {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// Define the props for the ResumeBuilder component
interface ResumeBuilderProps {
  initialData?: ResumeData & { _id?: string; name?: string; sectionOrder?: string[] }
  onSave?: (data: ResumeData & { name: string; sectionOrder: string[] }) => Promise<void>
  isSaving?: boolean
}

// SortableItem component for drag-and-drop functionality
const SortableItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="mb-6 border rounded-lg bg-white shadow-sm">
      <div className="flex items-center p-3 bg-emerald-100 border-b rounded-t-lg">
        <div {...listeners} className="mr-3 cursor-move">
          <GripVertical size={20} className="text-emerald-600" />
        </div>
        <h2 className="text-lg font-bold text-emerald-700">{id.charAt(0).toUpperCase() + id.slice(1)}</h2>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

// Function to calculate the completion percentage of the resume
const calculateCompletion = (data: ResumeData, sectionOrder: string[]) => {
  if (!data) return 0;

  const sectionWeights = {
    personalInfo: 15,
    professionalSummary: 15,
    experience: 20,
    education: 15,
    skills: 15,
    projects: 10,
    certificates: 5,
    customSections: 5
  };

  let totalWeight = 0;
  let completedWeight = 0;

  if (data.personalInfo) {
    const isPersonalInfoComplete = Object.values(data.personalInfo).every(value => value !== '');
    if (isPersonalInfoComplete) completedWeight += sectionWeights.personalInfo;
    totalWeight += sectionWeights.personalInfo;
  }

  if (data.professionalSummary && data.professionalSummary.trim() !== '') completedWeight += sectionWeights.professionalSummary;
  totalWeight += sectionWeights.professionalSummary;

  if (data.experience && data.experience.length > 0) completedWeight += sectionWeights.experience;
  totalWeight += sectionWeights.experience;

  if (data.education && data.education.length > 0) completedWeight += sectionWeights.education;
  totalWeight += sectionWeights.education;

  if (data.skills && data.skills.length > 0) completedWeight += sectionWeights.skills;
  totalWeight += sectionWeights.skills;

  if (data.projects && data.projects.length > 0) completedWeight += sectionWeights.projects;
  totalWeight += sectionWeights.projects;

  if (data.certificates && data.certificates.length > 0) completedWeight += sectionWeights.certificates;
  totalWeight += sectionWeights.certificates;

  const customSectionCount = sectionOrder.filter(section => section.startsWith('custom-')).length;
  if (customSectionCount > 0 && data.customSections) {
    const customSectionWeight = sectionWeights.customSections / customSectionCount;
    data.customSections.forEach(section => {
      if (section.items && section.items.length > 0) completedWeight += customSectionWeight;
      totalWeight += customSectionWeight;
    });
  }

  return totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
};

// Main ResumeBuilder component
export function ResumeBuilder({ initialData, onSave, isSaving }: ResumeBuilderProps) {
  // State for resume data
  const [resumeData, setResumeData] = useState<ResumeData>(() => {
    return {
      personalInfo: {
        name: '',
        email: '',
        phone: '',
        city: '',
        state: '',
        zipcode: '',
        country: '',
      },
      professionalSummary: '',
      experience: [],
      education: [],
      projects: [],
      certificates: [],
      customSections: [],
      skills: [],
      ...initialData
    };
  });

  // State for section order
  const [sectionOrder, setSectionOrder] = useState<string[]>(initialData?.sectionOrder || [
    'experience',
    'education',
    'skills',
    'projects',
    'certificates',
  ])

  // Other state variables
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [resumeName, setResumeName] = useState(initialData?.name || '')
  const { data: session } = useSession()
  const router = useRouter()
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([])
  const [isLoadingResumes, setIsLoadingResumes] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('edit')
  const [completionPercentage, setCompletionPercentage] = useState(0)
  const [userPlanType, setUserPlanType] = useState<"free" | "paid">('free')
  const [hasTrackedFirstSave, setHasTrackedFirstSave] = useState(false)

  // Set up sensors for drag and drop functionality
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Effect to fetch saved resumes
  useEffect(() => {
    const fetchSavedResumes = async () => {
      if (!session?.user) {
        setIsLoadingResumes(false)
        return
      }

      try {
        const response = await fetch('/api/resumes')
        if (!response.ok) {
          throw new Error('Failed to fetch resumes')
        }
        const data = await response.json()
        setSavedResumes(data)
        setLoadError(null)
      } catch (error) {
        console.error('Error fetching resumes:', error)
        setLoadError('Failed to load saved resumes. Please try again later.')
        toast({
          title: 'Error',
          description: 'Failed to fetch saved resumes',
          variant: 'destructive',
        })
      } finally {
        setIsLoadingResumes(false)
      }
    }

    if (!initialData) {
      fetchSavedResumes()
    }
  }, [session, toast, initialData])

  // Effect to update completion percentage
  useEffect(() => {
    const completionPercentage = calculateCompletion(resumeData, sectionOrder);
    setCompletionPercentage(completionPercentage);
  }, [resumeData, sectionOrder]);

  // Effect to update resume data when initialData changes
  useEffect(() => {
    if (initialData) {
      setResumeData(prevData => ({
        ...prevData,
        ...initialData
      }));
      setSectionOrder(initialData.sectionOrder || sectionOrder);
      setResumeName(initialData.name || '');
    }
  }, [initialData])

  useEffect(() => {
    const fetchUserPlanType = async () => {
      if (session?.user) {
        try {
          const userId = session.user.id // Assuming the user id is available here
          const response = await fetch(`/api/user-plan?userId=${userId}`)
          if (response.ok) {
            const data = await response.json()
            console.log('Fetched user plan type:', data.planType) // Add this log
            setUserPlanType(data.planType as "free" | "paid")
          } else {
            console.error('Error fetching user plan type:', await response.text())
          }
        } catch (error) {
          console.error('Error fetching user plan type:', error)
        }
      }
    }
  
    fetchUserPlanType()
  }, [session])

   // Development-only logging
   useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Current user plan type:', userPlanType)
    }
  }, [userPlanType])

  // Handle drag end for reordering sections
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    // Check if 'over' is not null before accessing its 'id' property
    if (over && active.id !== over.id) {
      setSectionOrder((items) => {
        const oldIndex = items.indexOf(String(active.id))
        const newIndex = items.indexOf(String(over.id))
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  // Update resume data for a specific section
  const updateResumeData = (section: keyof ResumeData, data: any) => {
    setResumeData((prev) => ({ ...prev, [section]: data }))
  }

  // Update personal information
  const updatePersonalInfo = (field: keyof ResumeData['personalInfo'], value: string) => {
    setResumeData((prev) => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        [field]: value,
      },
    }))
  }

  // Add a custom section
  const addCustomSection = () => {
    const newSection = {
      id: `custom-${Date.now()}`,
      title: 'New Section',
      items: [],
    }
    setResumeData((prev) => ({
      ...prev,
      customSections: [...prev.customSections, newSection],
    }))
    setSectionOrder((prev) => [...prev, newSection.id])
  }

  // Remove a custom section
  const removeCustomSection = (sectionId: string) => {
    setResumeData((prev) => ({
      ...prev,
      customSections: prev.customSections.filter((s) => s.id !== sectionId),
    }))
    setSectionOrder((prev) => prev.filter((id) => id !== sectionId))
  }

  // Handle saving the resume
  const handleSaveResume = async () => {
    if (!session) {
      router.push('/auth/signin')
      return
    }

    try {
      if (onSave) {
        await onSave({
          ...resumeData,
          name: resumeName,
          sectionOrder: sectionOrder,
        })
      } else {
        const response = await fetch('/api/resumes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: resumeName,
            data: resumeData,
            sectionOrder: sectionOrder,
          }),
        })

        if (response.ok) {
          const updatedResumes = await response.json()
          setSavedResumes(updatedResumes)

          // Track the "Resume Saved" event if it's the first time
          if (!hasTrackedFirstSave) {
            if (typeof window !== 'undefined' && window.gtag_report_conversion) {
              window.gtag_report_conversion()
            }
            setHasTrackedFirstSave(true)
          }
        } else if (response.status === 403) {
          throw new Error('You have reached your resume limit. Please upgrade your plan to save more resumes.')
        } else {
          throw new Error('Failed to save resume')
        }
      }

      setShowSaveDialog(false)
      toast({
        title: 'Success',
        description: 'Resume saved successfully!',
      })
    } catch (error) {
      console.error('Failed to save resume:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred while saving the resume. Please try again.',
        variant: 'destructive',
      })
    }
  }

  // Load a saved resume
  const loadResume = async (resumeId: string) => {
    try {
      const response = await fetch(`/api/resumes/${resumeId}`)
      if (response.ok) 

 {
        const loadedResume = await response.json()
        setResumeData(loadedResume.data)
        setSectionOrder(loadedResume.sectionOrder || sectionOrder)
        setResumeName(loadedResume.name)
        toast({
          title: "Success",
          description: "Resume loaded successfully!",
        })
      } else {
        throw new Error('Failed to load resume')
      }
    } catch (error) {
      console.error('Error loading resume:', error)
      toast({
        title: "Error",
        description: "Failed to load resume. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Render a specific section based on its ID
  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case 'experience':
        return (
          <ExperienceSection
            experience={resumeData.experience}
            updateExperience={(data) => updateResumeData('experience', data)}
          />
        )
      case 'education':
        return (
          <EducationSection
            education={resumeData.education}
            updateEducation={(data) => updateResumeData('education', data)}
          />
        )
      case 'projects':
        return (
          <ProjectsSection
            projects={resumeData.projects}
            updateProjects={(data) => updateResumeData('projects', data)}
          />
        )
      case 'certificates':
        return (
          <CertificatesSection
            certificates={resumeData.certificates}
            updateCertificates={(data) => updateResumeData('certificates', data)}
          />
        )
      case 'skills':
        return (
          <SkillsSection
            skills={resumeData.skills}
            updateSkills={(data) => updateResumeData('skills', data)}
            resumeData={resumeData}
          />
        )
      default:
        if (sectionId.startsWith('custom-')) {
          return (
            <CustomSection
              key={sectionId}
              section={resumeData.customSections.find((s) => s.id === sectionId)!}
              updateSection={(data) =>
                setResumeData((prev) => ({
                  ...prev,
                  customSections: prev.customSections.map((s) =>
                    s.id === sectionId ? data : s
                  ),
                }))
              }
              removeSection={() => removeCustomSection(sectionId)}
            />
          )
        }
        return null
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-white">
      <h1 className="text-4xl font-bold mb-8 text-center text-primary">IntelliResume Builder</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger
            value="edit"
            className="text-base py-2 px-4 flex items-center justify-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Edit Resume
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            className="text-base  py-2 px-4 flex items-center justify-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Preview
          </TabsTrigger>
        </TabsList>
        <TabsContent value="edit">
          <Card className="border-2 border-primary/20">
            <CardHeader className="bg-primary/5 rounded-t-lg">
              <CardTitle className="flex justify-between items-center text-xl">
                <span>Resume Editor</span>
                <span className="text-base font-normal">Completion: {completionPercentage.toFixed(0)}%</span>
              </CardTitle>
              <Progress value={completionPercentage} className="w-full h-2 mt-2" />
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-8">
                {resumeData && (
                  <PersonalInformationSection
                    personalInfo={resumeData.personalInfo}
                    updatePersonalInfo={updatePersonalInfo}
                  />
                )}
                {resumeData && (
                  <ProfessionalSummarySection
                    professionalSummary={resumeData.professionalSummary}
                    updateProfessionalSummary={(data) => updateResumeData('professionalSummary', data)}
                  />
                )}
                {resumeData && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={sectionOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      {sectionOrder.map((sectionId) => (
                        <SortableItem key={sectionId} id={sectionId}>
                          {renderSection(sectionId)}
                        </SortableItem>
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between bg-primary/5 p-4 rounded-b-lg">
              <Button onClick={addCustomSection} variant="outline" size="default" className="text-sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Custom Section
              </Button>
              <Button onClick={() => setShowSaveDialog(true)} size="default" className="text-sm">
                <Save className="mr-2 h-4 w-4" />
                Save Resume
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="preview">
          <Card className="border-2 border-primary/20">
            <CardHeader className="bg-primary/5 rounded-t-lg">
              <CardTitle className="text-xl text-center">Resume Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ATSResume 
                resumeData={resumeData} 
                sectionOrder={['personalInfo', 'professionalSummary', ...sectionOrder]} 
                userPlanType={userPlanType}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {!initialData && (
        <Card className="mt-8 border-2 border-primary/20">
          <CardHeader className="bg-primary/5 rounded-t-lg">
            <CardTitle className="text-xl text-center">Saved Resumes</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoadingResumes ? (
              <p className="text-center text-gray-500">Loading saved resumes...</p>
            ) : loadError ? (
              <div className="text-center text-red-500">
                <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                <p>{loadError}</p>
              </div>
            ) : savedResumes.length > 0 ? (
              <ul className="space-y-3">
                {savedResumes.map((resume) => (
                  <li key={resume._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="flex items-center">
                      <FileText className="mr-3 h-5 w-5" />
                      {resume.name}
                    </span>
                    <Button onClick={() => loadResume(resume._id)} variant="outline" size="sm">
                      Load
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-gray-500">No saved resumes yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl text-center">Save Resume</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Enter resume name"
            value={resumeName}
            onChange={(e) => setResumeName(e.target.value)}
            className="text-base py-2"
          />
          <DialogFooter>
            <Button onClick={handleSaveResume} disabled={isSaving} size="default" className="text-sm">
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}