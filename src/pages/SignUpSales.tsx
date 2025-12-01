import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { supabase, Dealer } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";
import { validatePassword } from "../lib/validation";

export function SignUpSales() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [dealerships, setDealerships] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDealerships, setLoadingDealerships] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    dealershipId: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    loadDealerships();
  }, []);

  const loadDealerships = async () => {
    try {
      const { data, error } = await supabase
        .from("dealers")
        .select("id, name")
        .order("name");

      if (error) throw error;
      if (data) setDealerships(data as Dealer[]);
    } catch (err) {
      showToast("Failed to load dealerships", "error");
    } finally {
      setLoadingDealerships(false);
    }
  };

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

      const anonClient = supabase;

      const { data: preRegistered, error: checkError } = await anonClient
        .from("sales")
        .select("*")
        .eq("dealer_id", formData.dealershipId)
        .eq("email", normalizedEmail)
        .eq("status", "pending_signup")
        .maybeSingle();

      if (checkError) {
        console.error("Database error checking pre-registration:", checkError);
        throw new Error(
          checkError.message || "Database error. Please try again or contact support."
        );
      }

      if (!preRegistered) {
        throw new Error(
          "Unable to create account. Please contact your dealership administrator to be added to the team roster."
        );
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: formData.password,
        options: {
          data: {
            role: 'sales',
            dealer_id: formData.dealershipId
          }
        }
      });

      if (authError) {
        console.error("Auth error during signup:", authError);
        if (authError.message === "User already registered") {
          showToast("An account with this email already exists.", "error");
          setTimeout(() => {
            navigate("/login?type=sales");
          }, 2000);
          return;
        }
        throw new Error(authError.message || "Authentication error. Please try again.");
      }
      if (!authData.user) throw new Error("Failed to create account");

      const { error: updateError } = await supabase
        .from("sales")
        .update({
          user_id: authData.user.id,
          status: "active",
          activated_at: new Date().toISOString(),
          password_changed: true,
        })
        .eq("id", preRegistered.id);

      if (updateError) {
        console.error("Error updating sales record:", updateError);
        throw new Error(
          updateError.message || "Failed to activate account. Please contact support."
        );
      }

      showToast("Account created successfully! Welcome to SwapRunn.", "success");
      navigate("/sales");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <button
          onClick={() => navigate("/")}
          className="flex items-center text-gray-600 hover:text-black mb-6 transition"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Home
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Sales Sign Up</h1>
            <p className="text-gray-600">
              Create your account to start managing deliveries
            </p>
          </div>

          {loadingDealerships ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Building2 size={16} />
                  <span>Select Your Dealership</span>
                </label>
                <select
                  required
                  value={formData.dealershipId}
                  onChange={(e) =>
                    setFormData({ ...formData, dealershipId: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                >
                  <option value="">Choose a dealership</option>
                  {dealerships.map((dealer) => (
                    <option key={dealer.id} value={dealer.id}>
                      {dealer.name}
                    </option>
                  ))}
                </select>
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
                  placeholder="your.email@dealership.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use the email your administrator added to the team roster
                </p>
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
                {loading ? "Creating Account..." : "Create Account"}
              </button>

              <div className="text-center text-sm">
                <p className="text-gray-600">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/login?type=sales")}
                    className="text-red-600 hover:text-red-700 font-semibold underline"
                  >
                    Log In Here
                  </button>
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mt-4">
                <p className="text-sm text-blue-800 mb-3">
                  <strong>Note:</strong> Your dealership administrator must add you to the team roster before you can sign up. If you encounter an error, please contact your administrator.
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
          )}
        </div>
      </div>
    </div>
  );
}
