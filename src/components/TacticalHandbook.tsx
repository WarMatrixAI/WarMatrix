import React, { useState } from 'react';
import { Search, BookOpen, ChevronRight, Shield, Target, Zap, Waves, Maximize2 } from 'lucide-react';

interface SOP {
    id: string;
    title: string;
    icon: any;
    content: string;
    category: 'TACTICAL' | 'DEFENSIVE' | 'LOGISTICS';
}

const SOPS: SOP[] = [
    {
        id: 'recon-01',
        title: 'Reconnaissance-in-Force',
        icon: Target,
        category: 'TACTICAL',
        content: `Establish forward observation posts at grid intersections. Deploy light mechanized units in a leapfrog pattern to trigger enemy fire and reveal hidden positions without committing main battle forces. 

OPERATIONAL PARAMETERS:
1. Maintain 500m spacing between lead elements.
2. Airborne drones must maintain 200m altitude for optimal signal-to-noise ratio.
3. ENGAGEMENT: Fire only when compromised or to draw specific heavy assets into visibility.`
    },
    {
        id: 'def-02',
        title: 'Elastic Defense Grid',
        icon: Shield,
        category: 'DEFENSIVE',
        content: `Identify primary and secondary fall-back lines. When engaged by superior force, front-line units should conduct a fighting withdrawal to drawing the enemy into prepared kill zones under friendly artillery cover. 

DEFENSIVE LAYERS:
- ALPHA: Screening force with high mobility.
- BRAVO: Hardened bunker positions with overlapped fire fields.
- CHARLIE: Reserve counter-attack element positioned in defilade.`
    },
    {
        id: 'ambush-03',
        title: 'L-Shaped Ambush',
        icon: Zap,
        category: 'TACTICAL',
        content: `Position an assault element parallel to the enemy direction of travel and a support element perpendicular. This creates a lethal crossfire while preventing friendly fire incidents. 

EXECUTION CRITERIA:
1. Initiate with claymores or high-volume automatic fire.
2. Support element provides suppression while assault element conducts clean-up.
3. SIGNAL: Deployment of red flare indicates immediate transition to EXFIL mode.`
    },
    {
        id: 'storm-04',
        title: 'Adverse Weather Ops',
        icon: Waves,
        category: 'LOGISTICS',
        content: `During heavy precipitation or fog, reduce mechanized speed by 40%. Increase dependence on thermal optics and short-range acoustic sensors. Maintain strict radio silence to prevent signal triangulation in humid conditions. 

LOGISTICAL ADJUSTMENTS:
- Supply intervals increased by 20% due to mud/terrain degradation.
- Laser guidance restricted to 1.2km ranges.
- Emergency beacons use infrared-only strobes to bypass atmospheric scattering.`
    }
];

interface TacticalHandbookProps {
    onMaximize?: () => void;
}

export function TacticalHandbook({ onMaximize }: TacticalHandbookProps) {
    const [search, setSearch] = useState('');
    const [selectedSop, setSelectedSop] = useState<SOP | null>(null);

    const filtered = SOPS.filter(s => 
        s.title.toLowerCase().includes(search.toLowerCase()) || 
        s.category.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-2.5">
            <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#4B6A8A]" />
                    <input 
                        type="text" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search Doctrine..."
                        className="w-full bg-[#0D1117] border border-[#1F6FEB]/20 rounded-sm py-1.5 pl-8 pr-2 text-[11px] font-mono text-[#E6EDF3] placeholder:text-[#4B6A8A] focus:outline-none focus:border-[#3A8DFF]/40 transition-all"
                    />
                </div>
                {onMaximize && (
                    <button 
                        onClick={onMaximize}
                        className="p-1.5 rounded-sm border border-[#1F6FEB]/20 text-[#4B6A8A] hover:text-[#3A8DFF] hover:border-[#3A8DFF]/40 transition-all"
                    >
                        <Maximize2 className="w-3 h-3" />
                    </button>
                )}
            </div>

            <div className="flex flex-col gap-1.5 max-h-[500px] overflow-y-auto pr-1 warmatrix-scrollbar">
                {selectedSop ? (
                    <div className="flex flex-col gap-2 p-2.5 rounded-sm border border-[#3A8DFF]/40 bg-[#0A1020] shadow-[0_0_20px_rgba(31,111,235,0.05)]">
                        <button 
                            onClick={() => setSelectedSop(null)}
                            className="text-[9px] font-bold uppercase text-[#3A8DFF] hover:text-[#5CABFF] transition-colors mb-1 flex items-center gap-1"
                        >
                            <span>‹</span> Back to Doctrine List
                        </button>
                        <div className="flex items-center gap-2 border-b border-[#1F6FEB]/20 pb-1.5 mb-1">
                            <selectedSop.icon className="w-3.5 h-3.5 text-[#3A8DFF]" />
                            <h4 className="text-[12.5px] font-bold text-[#E6EDF3] uppercase tracking-wider">{selectedSop.title}</h4>
                        </div>
                        <p className="text-[10.5px] font-mono text-[#9CA3AF] leading-relaxed whitespace-pre-line">
                            {selectedSop.content}
                        </p>
                    </div>
                ) : (
                    filtered.map(sop => (
                        <button 
                            key={sop.id}
                            onClick={() => setSelectedSop(sop)}
                            className="flex items-center justify-between p-2 rounded-sm border border-[#1F6FEB]/10 bg-[#080E1C]/60 hover:bg-[#1F6FEB]/10 group transition-all"
                        >
                            <div className="flex items-center gap-2">
                                <sop.icon className="w-3 h-3 text-[#4B6A8A] group-hover:text-[#3A8DFF]" />
                                <span className="text-[10.5px] font-bold text-[#8B9BAF] group-hover:text-[#E6EDF3]">{sop.title}</span>
                            </div>
                            <ChevronRight className="w-3 h-3 text-[#4B6A8A]" />
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
