"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui-custom/Button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Scale,
  Ruler,
  Camera,
  Plus,
  X,
  TrendingDown,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { db, type BodyMeasurement, type ProgressPhoto } from "@/db";
import { uid } from "@/utils/id";
import { useThemeColors } from "@/hooks/useThemeColors";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function BodyPage() {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [photos, setPhotos] = useState<(ProgressPhoto & { url: string })[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    weight: "",
    bodyFat: "",
    waist: "",
    chest: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chartColors = useThemeColors();
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  async function loadData() {
    try {
      const [measurementsData, photosData] = await Promise.all([
        db.bodyMeasurements.orderBy("date").reverse().toArray(),
        db.progressPhotos.orderBy("date").reverse().toArray(),
      ]);

      setMeasurements(measurementsData);

      const photosWithUrls = photosData.map((photo) => ({
        ...photo,
        url: URL.createObjectURL(photo.imageBlob),
      }));
      setPhotos(photosWithUrls);

      cleanupRef.current = () => {
        photosWithUrls.forEach((p) => URL.revokeObjectURL(p.url));
      };
    } catch (error) {
      console.error("Failed to load body data:", error);
    }
  }

  // Load data
  useEffect(() => {
    loadData();
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  // Handle measurement submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const measurement: BodyMeasurement = {
      id: uid(),
      date: new Date().toISOString(),
      weight: formData.weight ? Number(formData.weight) : undefined,
      bodyFat: formData.bodyFat ? Number(formData.bodyFat) : undefined,
      waist: formData.waist ? Number(formData.waist) : undefined,
      chest: formData.chest ? Number(formData.chest) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.bodyMeasurements.add(measurement);
    setFormData({ weight: "", bodyFat: "", waist: "", chest: "" });
    setShowAddForm(false);
    loadData();
  }

  // Handle photo upload
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create thumbnail
    const imageBlob = file;

    const photo: ProgressPhoto = {
      id: uid(),
      date: new Date().toISOString(),
      type: "front",
      imageBlob,
      createdAt: new Date().toISOString(),
    };

    await db.progressPhotos.add(photo);
    loadData();

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Delete photo
  async function deletePhoto(id: string) {
    if (!confirm("Are you sure you want to delete this photo?")) return;
    await db.progressPhotos.delete(id);
    loadData();
  }

  // Prepare chart data
  const chartData = measurements
    .filter((m) => m.weight)
    .slice(0, 30)
    .reverse()
    .map((m) => ({
      date: m.date.split("T")[0],
      weight: m.weight,
    }));

  const latestMeasurement = measurements[0];

  return (
    <div className="space-y-6 pb-6 pt-2">
      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-xl font-bold text-text-primary uppercase tracking-wider">
          Body Profile
        </h1>
        <p className="mt-1 text-sm text-text-secondary">Track your physical transformation</p>
      </motion.div>

      {/* ── Current Stats ── */}
      <motion.div
        className="grid grid-cols-2 gap-3"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
      >
        <div className="flex items-center gap-3 rounded-[--radius-card] glass-card p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-muted border border-primary/20">
            <Scale className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-text-secondary uppercase tracking-wider truncate">Weight</p>
            <p className="text-xl font-bold text-text-primary tabular-nums">
              {latestMeasurement?.weight ?? "—"}
              <span className="text-xs text-text-secondary ml-1 uppercase tracking-wider">kg</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[--radius-card] glass-card p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/10 border border-success/20">
            <TrendingDown className="h-6 w-6 text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-text-secondary uppercase tracking-wider truncate">
              Body Fat
            </p>
            <p className="text-xl font-bold text-text-primary tabular-nums">
              {latestMeasurement?.bodyFat ?? "—"}
              <span className="text-xs text-text-secondary ml-0.5">%</span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Weight Progress Chart ── */}
      <motion.div
        className="rounded-[--radius-card] glass-card p-5"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
      >
        <div className="mb-4 flex flex-wrap gap-2 items-center justify-between">
          <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">
            Weight Trend
          </h2>
          <Button
            onClick={() => setShowAddForm(true)}
            size="sm"
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
          >
            Log Data
          </Button>
        </div>

        {chartData.length > 1 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartColors.textMuted, fontSize: 10 }}
                  tickFormatter={(d) =>
                    new Date(d).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                    })
                  }
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartColors.textMuted, fontSize: 10 }}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.surface,
                    border: `1px solid ${chartColors.border}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: chartColors.text }}
                  itemStyle={{ color: chartColors.text }}
                  formatter={(value) => [`${Number(value)} kg`, "Weight"]}
                  labelFormatter={(d) => new Date(d).toLocaleDateString("en-US")}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke={chartColors.primary}
                  strokeWidth={2}
                  dot={{ fill: chartColors.primary, strokeWidth: 0, r: 4 }}
                  activeDot={{
                    r: 6,
                    fill: chartColors.primary,
                    stroke: chartColors.surface,
                    strokeWidth: 2,
                  }}
                  animationDuration={800}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <div className="h-10 w-10 bg-bg-elevated rounded-full animate-pulse flex items-center justify-center">
              <Scale className="h-5 w-5 text-text-secondary" />
            </div>
            <p className="text-sm text-text-secondary uppercase tracking-wider">
              Log your weight to see progress
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Measurements Table ── */}
      <motion.div
        className="rounded-[--radius-card] glass-card p-5"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={2}
      >
        <div className="mb-4 flex items-center gap-2">
          <Ruler className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">
            Measurements
          </h2>
        </div>

        {measurements.length > 0 ? (
          <div className="overflow-x-auto no-scrollbar -mx-2 px-2">
            <table className="w-full min-w-[300px] text-left">
              <thead>
                <tr className="border-b border-border/50 text-xs text-text-secondary uppercase tracking-wider">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Chest</th>
                  <th className="pb-2 font-medium">Waist</th>
                  <th className="pb-2 font-medium">Weight</th>
                </tr>
              </thead>
              <tbody className="text-sm tabular-nums">
                {measurements.slice(0, 5).map((m) => (
                  <tr key={m.id} className="border-b border-border/30 last:border-0">
                    <td className="py-3 text-text-secondary whitespace-nowrap">
                      {new Date(m.date).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="py-3 text-text-primary">
                      {m.chest ?? "—"} <span className="text-text-secondary text-xs">cm</span>
                    </td>
                    <td className="py-3 text-text-primary">
                      {m.waist ?? "—"} <span className="text-text-secondary text-xs">cm</span>
                    </td>
                    <td className="py-3 font-semibold text-primary">
                      {m.weight ?? "—"} <span className="text-text-secondary text-xs">kg</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <div className="h-10 w-10 bg-bg-elevated rounded-full animate-pulse flex items-center justify-center">
              <Ruler className="h-5 w-5 text-text-secondary" />
            </div>
            <p className="text-sm text-text-secondary uppercase tracking-wider">
              No measurements recorded
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Progress Photos ── */}
      <motion.div
        className="rounded-[--radius-card] glass-card p-5"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={3}
      >
        <div className="mb-4 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-warning" />
            <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">
              Progress Photos
            </h2>
          </div>
          <label className="flex cursor-pointer items-center gap-1 rounded-lg bg-warning/10 border border-warning/20 px-3 py-1.5 text-xs font-semibold text-warning transition-colors hover:bg-warning/20">
            <Plus className="h-4 w-4" />
            Add Photo
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </label>
        </div>

        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-bg-elevated border border-border/50"
              >
                <img
                  src={photo.url}
                  alt="Progress"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100" />
                <button
                  onClick={() => photo.id && deletePhoto(photo.id)}
                  className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-xl bg-danger/90 backdrop-blur-sm text-text-primary opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 active:scale-95 cursor-pointer"
                  aria-label="Delete photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <p className="absolute bottom-2 left-2 text-xs uppercase font-bold tracking-wider text-text-primary opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                  {new Date(photo.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "2-digit",
                  })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-10 border border-dashed border-border rounded-xl bg-bg-elevated/30">
            <ImageIcon className="h-10 w-10 text-text-secondary/30" />
            <p className="text-sm font-medium text-text-secondary uppercase tracking-wider">
              No photos yet
            </p>
            <p className="text-xs text-text-secondary uppercase tracking-wider">
              Upload photos to track changes
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Add Measurement Modal ── */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddForm(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-t-2xl glass-card border-b-0 border-x-0 p-5"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1 g-border w-12 rounded-full bg-border" />

              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">
                  Log New Measurements
                </h2>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-secondary">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm font-semibold tabular-nums text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      placeholder="75.5"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-secondary">
                      Body Fat (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.bodyFat}
                      onChange={(e) => setFormData({ ...formData, bodyFat: e.target.value })}
                      className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm font-semibold tabular-nums text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      placeholder="18"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-secondary">
                      Chest (cm)
                    </label>
                    <input
                      type="number"
                      value={formData.chest}
                      onChange={(e) => setFormData({ ...formData, chest: e.target.value })}
                      className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm font-semibold tabular-nums text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      placeholder="105"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-secondary">
                      Waist (cm)
                    </label>
                    <input
                      type="number"
                      value={formData.waist}
                      onChange={(e) => setFormData({ ...formData, waist: e.target.value })}
                      className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm font-semibold tabular-nums text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      placeholder="82"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="mt-4 w-full py-4 text-sm uppercase tracking-wider"
                >
                  Save Measurements
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
