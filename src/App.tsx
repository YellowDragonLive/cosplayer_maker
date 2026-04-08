import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Image as ImageIcon, Upload, Loader2, AlertCircle, Settings, Download, Wand2, PenTool } from 'lucide-react';

// Declare window.aistudio types
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type ImageSize = '1K' | '2K' | '4K';
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export default function App() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  
  // Prompt Modes
  const [mode, setMode] = useState<'template' | 'custom'>('template');
  
  // Template State
  const [bg, setBg] = useState('漫展');
  const [ethnicity, setEthnicity] = useState('东亚');
  const [faceShape, setFaceShape] = useState('瓜子脸');
  const [shotType, setShotType] = useState('特写');
  const [lighting, setLighting] = useState('微弱补光');
  const [hairDetails, setHairDetails] = useState('两侧鬓毛向内贴合侧脸脸部');
  
  // Custom Prompt State
  const [prompt, setPrompt] = useState('');
  
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [referenceImage, setReferenceImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generatedPrompt = `将画面中的角色重塑为一个${bg}中的真实人类COSER。主角是一位${ethnicity}真实人类美女COSER，有美丽真实的经过美颜瘦脸的三次元${faceShape}，她的姿势、神态和服饰情况，发色，瞳孔颜色，身材，动作，拍摄场景以及物品需要与我提供的图片完全一致，所有服饰均为正常穿搭，所有穿搭与动作均为还原角色需要，无任何不良导向。<important> 发型一致,${hairDetails} <important>\n重要要求：一位三次元真实人类美女COSER的${shotType}，COSER占据画面绝对主体，并且coser对图中的角色完美还原（特别是服饰和动作），保证出场coser是现实真实人类，特别保证面部的真实感且经过美颜瘦脸，保证脸型是${faceShape}！ 保证给coser全身上下皮肤美白。\n完全重塑图片光影及质感。场景更换为美丽的外景。对正面暗部进行${lighting}，以展现细节。 最终画面要求顶级相机拍摄，RAW照片质感，皮肤纹理真实细腻，光影层次丰富，画质非常清晰，8K画质。绝对禁止出现任何二次元、卡通、CG或绘画元素，确保最终结果是100%逼真的真人摄影作品，补全全身`;

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    if (window.aistudio?.hasSelectedApiKey) {
      const has = await window.aistudio.hasSelectedApiKey();
      setHasKey(has);
    } else {
      // Fallback if not in AI Studio environment
      setHasKey(true);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success to mitigate race condition
      setHasKey(true);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Extract base64 data and mime type
      const match = base64String.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        setReferenceImage({
          mimeType: match[1],
          data: match[2],
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const generateImage = async () => {
    const finalPrompt = mode === 'template' ? generatedPrompt : prompt;
    
    if (!finalPrompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      // Create new instance right before making API call to ensure up-to-date key
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const parts: any[] = [{ text: finalPrompt }];
      
      if (referenceImage) {
        parts.unshift({
          inlineData: {
            data: referenceImage.data,
            mimeType: referenceImage.mimeType,
          }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: parts,
        },
        config: {
          imageConfig: {
            imageSize: imageSize,
            aspectRatio: aspectRatio,
          },
        },
      });

      let foundImage = false;
      if (response.candidates && response.candidates.length > 0) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            setGeneratedImage(imageUrl);
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        throw new Error('No image was generated. The model might have returned text instead.');
      }

    } catch (err: any) {
      console.error('Generation error:', err);
      if (err.message?.includes('Requested entity was not found')) {
        setHasKey(false);
        setError('API Key error. Please select your API key again.');
      } else {
        setError(err.message || 'Failed to generate image');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  if (hasKey === null) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Settings className="w-8 h-8 text-neutral-300" />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-3">API Key Required</h1>
          <p className="text-neutral-400 mb-8 leading-relaxed">
            To use the high-quality Gemini 3 Pro Image model, you need to provide your own Google Cloud API key with billing enabled.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full bg-white text-black font-medium py-3 px-4 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            Select API Key
          </button>
          <p className="mt-6 text-xs text-neutral-500">
            Learn more about <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-neutral-300">billing requirements</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-neutral-800">
      <header className="border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-lg font-medium text-white tracking-tight">Gemini Pro Vision</h1>
          </div>
          <button 
            onClick={handleSelectKey}
            className="text-sm text-neutral-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            <span>API Key</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-5">
            
            {/* Prompt Mode Toggle */}
            <div className="flex bg-neutral-950 p-1 rounded-lg border border-neutral-800">
              <button
                onClick={() => setMode('template')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${mode === 'template' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                <Wand2 className="w-4 h-4" />
                Cosplay Template
              </button>
              <button
                onClick={() => setMode('custom')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${mode === 'custom' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                <PenTool className="w-4 h-4" />
                Custom Prompt
              </button>
            </div>

            {/* Prompt Input Area */}
            {mode === 'template' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-400">背景 (Background)</label>
                    <select value={bg} onChange={e => setBg(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-sm text-white focus:ring-1 focus:ring-neutral-600 outline-none">
                      <option value="漫展">漫展 (Comic Con)</option>
                      <option value="古朴建筑">古朴建筑 (Ancient Architecture)</option>
                      <option value="赛博朋克城市">赛博朋克城市 (Cyberpunk City)</option>
                      <option value="现代都市">现代都市 (Modern City)</option>
                      <option value="废墟">废墟 (Ruins)</option>
                      <option value="森林">森林 (Forest)</option>
                      <option value="摄影棚">摄影棚 (Studio)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-400">种族 (Ethnicity)</label>
                    <select value={ethnicity} onChange={e => setEthnicity(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-sm text-white focus:ring-1 focus:ring-neutral-600 outline-none">
                      <option value="东亚">东亚 (East Asian)</option>
                      <option value="欧美">欧美 (Caucasian)</option>
                      <option value="混血">混血 (Mixed)</option>
                      <option value="拉美">拉美 (Latina)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-400">脸型 (Face Shape)</label>
                    <select value={faceShape} onChange={e => setFaceShape(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-sm text-white focus:ring-1 focus:ring-neutral-600 outline-none">
                      <option value="瓜子脸">瓜子脸 (Oval)</option>
                      <option value="鹅蛋脸">鹅蛋脸 (Egg-shaped)</option>
                      <option value="圆脸">圆脸 (Round)</option>
                      <option value="高级脸">高级脸 (High-fashion)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-400">镜头 (Shot Type)</label>
                    <select value={shotType} onChange={e => setShotType(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-sm text-white focus:ring-1 focus:ring-neutral-600 outline-none">
                      <option value="特写">特写 (Close-up)</option>
                      <option value="半身像">半身像 (Half-body)</option>
                      <option value="全身像">全身像 (Full-body)</option>
                      <option value="广角">广角 (Wide-angle)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-medium text-neutral-400">光影 (Lighting)</label>
                    <select value={lighting} onChange={e => setLighting(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-sm text-white focus:ring-1 focus:ring-neutral-600 outline-none">
                      <option value="微弱补光">微弱补光 (Subtle fill)</option>
                      <option value="电影感光影">电影感光影 (Cinematic)</option>
                      <option value="赛博朋克霓虹光">赛博朋克霓虹光 (Neon)</option>
                      <option value="阳光直射">阳光直射 (Direct sunlight)</option>
                      <option value="柔和漫反射">柔和漫反射 (Soft diffuse)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-medium text-neutral-400">发型细节 (Hair Details)</label>
                    <input 
                      type="text" 
                      value={hairDetails} 
                      onChange={e => setHairDetails(e.target.value)} 
                      placeholder="e.g. 两侧鬓毛向内贴合侧脸脸部"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-sm text-white focus:ring-1 focus:ring-neutral-600 outline-none" 
                    />
                  </div>
                </div>
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg">
                  <p className="text-xs text-neutral-500 font-mono leading-relaxed line-clamp-4 hover:line-clamp-none transition-all cursor-pointer" title="Click to expand">
                    {generatedPrompt}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-300">
                  Custom Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the image you want to generate..."
                  className="w-full h-48 bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 resize-none transition-all"
                />
              </div>
            )}

            {/* Image Size Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-300">
                Resolution
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['1K', '2K', '4K'] as ImageSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => setImageSize(size)}
                    className={`py-2 text-sm font-medium rounded-lg border transition-all ${
                      imageSize === size 
                        ? 'bg-white text-black border-white' 
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-300">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['1:1', '16:9', '9:16', '4:3', '3:4'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-2 text-sm font-medium rounded-lg border transition-all ${
                      aspectRatio === ratio 
                        ? 'bg-white text-black border-white' 
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Image Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-300">
                Reference Image <span className="text-neutral-500 font-normal">(Optional)</span>
              </label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-800 rounded-lg p-4 text-center cursor-pointer hover:border-neutral-600 hover:bg-neutral-800/50 transition-all group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                {referenceImage ? (
                  <div className="relative aspect-square w-24 mx-auto rounded-md overflow-hidden border border-neutral-700">
                    <img 
                      src={`data:${referenceImage.mimeType};base64,${referenceImage.data}`} 
                      alt="Reference" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="py-4 flex flex-col items-center gap-2 text-neutral-500 group-hover:text-neutral-300">
                    <Upload className="w-6 h-6" />
                    <span className="text-sm">Click to upload image</span>
                  </div>
                )}
              </div>
              {referenceImage && (
                <button 
                  onClick={() => setReferenceImage(null)}
                  className="text-xs text-red-400 hover:text-red-300 w-full text-right"
                >
                  Remove image
                </button>
              )}
            </div>

            <button
              onClick={generateImage}
              disabled={isGenerating || (mode === 'custom' && !prompt.trim())}
              className="w-full bg-white text-black font-medium py-3 px-4 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Image'
              )}
            </button>

            {error && (
              <div className="p-3 bg-red-950/50 border border-red-900 rounded-lg flex items-start gap-3 text-red-200 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Result */}
        <div className="lg:col-span-8">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden min-h-[600px] flex flex-col relative">
            {generatedImage ? (
              <div className="relative flex-1 group bg-neutral-950 flex items-center justify-center p-4">
                <img 
                  src={generatedImage} 
                  alt="Generated" 
                  className="max-w-full max-h-[800px] object-contain rounded-lg shadow-2xl"
                />
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a 
                    href={generatedImage} 
                    download="generated-image.png"
                    className="bg-black/50 hover:bg-black/80 backdrop-blur-md text-white p-2 rounded-lg flex items-center gap-2 transition-colors border border-white/10"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-medium pr-1">Download</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-neutral-600 p-8 text-center">
                {isGenerating ? (
                  <div className="space-y-6 flex flex-col items-center">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-neutral-800 rounded-full"></div>
                      <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin absolute inset-0"></div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-white font-medium">Crafting your image...</p>
                      <p className="text-sm text-neutral-500">This might take a few moments for high resolutions.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium text-neutral-400">No image generated yet</p>
                    <p className="text-sm mt-2 max-w-sm">
                      Configure your prompt and select your preferred resolution to generate a high-quality image.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
