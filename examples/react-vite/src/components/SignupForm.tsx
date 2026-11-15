import { Button } from "./Button";

export type SignupFormProps = {
  title?: string;
};

export const SignupForm = ({ title = "Create your account" }: SignupFormProps) => (
  <form
    aria-label="Sign up"
    className="card"
    data-testid="signup-form"
    onSubmit={(event) => event.preventDefault()}
  >
    <h2>{title}</h2>
    <p>Start your 14-day free trial. No credit card required.</p>
    <div className="field">
      <label htmlFor="signup-name">Full name</label>
      <input id="signup-name" placeholder="Jane Doe" />
    </div>
    <div className="field">
      <label htmlFor="signup-email">Email</label>
      <input id="signup-email" placeholder="jane@example.com" type="email" />
    </div>
    <div className="actions">
      <Button variant="secondary">Cancel</Button>
      <Button type="submit">Sign up</Button>
    </div>
  </form>
);
