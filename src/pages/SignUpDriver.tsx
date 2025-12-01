import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, User, Phone, Truck, MapPin } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";
import { validatePassword } from "../lib/validation";

export function SignUpDriver() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    vehicleType: "",
    licenseNumber: "",
    radius: "50",
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (formData.password !== formData.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.message);
      }

      const normalizedEmail = formData.email.toLowerCase().trim();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: formData.password,
        options: {
          data: {
            role: 'driver',
            name: formData.name,
          }
        }
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          throw new Error("An account with this email already exists. Please log in instead.");
        }
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error("Failed to create authentication account");
      }

      const { error: driverError } = await supabase
        .from("drivers")
        .insert({
          user_id: authData.user.id,
          name: formData.name,
          email: normalizedEmail,
          phone: formData.phone,
          vehicle_type: formData.vehicleType,
          license_number: formData.licenseNumber || null,
          radius: parseInt(formData.radius),
          activated_at: new Date().toISOString(),
        });

      if (driverError) {
        await supabase.auth.signOut();

        if (driverError.code === '23505') {
          throw new Error("A driver profile already exists for this account");
        }

        if (driverError.code === '42501') {
          throw new Error("Permission denied. Please check your account settings");
        }

        throw new Error(`Failed to create driver profile: ${driverError.message}`);
      }

      showToast("Account created successfully!", "success");
      navigate("/driver");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate("/")}
          className="flex items-center text-gray-600 hover:text-black mb-6 transition"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Home
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Driver Sign Up</h1>
            <p className="text-gray-600">
              Create your driver profile to get started
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <User size={16} />
                  <span>Full Name</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Mail size={16} />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Phone size={16} />
                  <span>Phone Number</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Truck size={16} />
                  <span>Vehicle Type</span>
                </label>
                <select
                  required
                  value={formData.vehicleType}
                  onChange={(e) =>
                    setFormData({ ...formData, vehicleType: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                >
                  <option value="">Select Vehicle Type</option>
                  <option value="car">Car</option>
                  <option value="truck">Truck</option>
                  <option value="trailer">Trailer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Driver's License Number (Optional)
                </label>
                <input
                  type="text"
                  value={formData.licenseNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, licenseNumber: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <MapPin size={16} />
                  <span>Service Radius (miles)</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.radius}
                  onChange={(e) =>
                    setFormData({ ...formData, radius: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Lock size={16} />
                  <span>Create Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-2 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>At least 8 characters with uppercase, lowercase, and number</span>
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Lock size={16} />
                  <span>Confirm Password</span>
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating Account..." : "Create Driver Account"}
              </button>

              <div className="text-center text-sm">
                <p className="text-gray-600">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/login?type=driver")}
                    className="text-red-600 hover:text-red-700 font-semibold underline"
                  >
                    Log In Here
                  </button>
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <p className="text-sm text-blue-800 mb-3">
                  <strong>How it works:</strong> After creating your account, you'll have access to your driver dashboard where you can manage your profile and availability.
                </p>
                <p className="text-xs text-gray-600">
                  By signing up, you agree to our{' '}
                  <button
                    type="button"
                    onClick={() => window.open('/terms-of-service', '_blank')}
                    className="text-red-600 hover:text-red-700 font-semibold underline"
                  >
                    Terms of Service
                  </button>
                  {' '}and{' '}
                  <button
                    type="button"
                    onClick={() => window.open('/privacy-policy', '_blank')}
                    className="text-red-600 hover:text-red-700 font-semibold underline"
                  >
                    Privacy Policy
                  </button>
                </p>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
}
