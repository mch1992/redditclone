import React, { Component } from 'react';
import { BrowserRouter as Router, Route, Link, Switch, Redirect } from 'react-router-dom';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import InputGroup from 'react-bootstrap/InputGroup';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Alert from 'react-bootstrap/Alert';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import './App.css';

class CommentForm extends Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.textarea = React.createRef();
    this.showReplyForm = this.showReplyForm.bind(this);
    this.hideReplyForm = this.hideReplyForm.bind(this);
    this.state = {
      formClass: (this.props.topComment ? 'show' : 'hide')
    };
  }

  handleSubmit(event) {
    fetch('/comments/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${localStorage.getItem('jwtToken')}`
      },
      body: JSON.stringify({
        comment: {
          post_id: this.props.postId,
          parent_comment_id: this.props.parent_comment_id,
          text: this.state.text
        }})
    })
      .then(response => response.json())
      .then(data => {
        this.textarea.current.value = "";
        this.props.updatePost(data);
        this.props.updateParent(data);
        if (!this.props.topComment) {
          this.setState({
            formClass: 'hide'
          });
        }
      });

    event.preventDefault();
  }

  handleChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    });
  }

  showReplyForm(event) {
    this.setState({
      formClass: 'show'
    });
    event.preventDefault();
  }

  hideReplyForm() {
    this.setState({
      formClass: 'hide'
    });
  }

  render() {
    if (!authenticated()) {
      return '';
    }
    let replyLink = '';
    let cancelButton = '';
    if (!this.props.topComment) {
      replyLink = <a href="#" onClick={this.showReplyForm}>reply</a>;
      cancelButton = (
        <Button
          variant="secondary"
          onClick={this.hideReplyForm}
        >
          Cancel
        </Button>
      );
    }
    return (
      <div>
        {replyLink}
        <Form onSubmit={this.handleSubmit} className={this.state.formClass}>
          <Form.Group as={Col} md="5" controlId="text">
            <Form.Label>Speaking as {localStorage.getItem('username')}</Form.Label>
            <Form.Control
              onChange={this.handleChange}
              as="textarea"
              name="text"
              placeholder="Comment"
              rows="5"
              ref={this.textarea}
            />
          </Form.Group>
          <Form.Group as={Col}>
            <Button type="submit">Save</Button>
            {cancelButton}
          </Form.Group>
        </Form>
      </div>
    );
  }
}

class Comment extends Component {
  constructor(props) {
    super(props);
    this.state = {
      childComments: this.props.comment.child_comments
    };
    this.updateChildComments = this.updateChildComments.bind(this);
  }

  updateChildComments(newComment) {
    this.setState((state, props) => {
      console.log(this.props.comment);
      console.log(state.childComments);
      return {childComments: state.childComments.concat(newComment)};
    });
  }

  render() {
    const { author, score, text, last_modified } = this.props.comment;
    const { post, updatePost } = this.props;
    return (
      <ul>
        <li>
          <div>
            <p>{author} {score} point{score === 1 ? '' : 's'} {last_modified}</p>
            <p>{text}</p>
            <CommentForm
              postId={post.id}
              updatePost={updatePost}
              updateParent={this.updateChildComments}
              parent_comment_id={this.props.comment.id}
            />
            {this.state.childComments.map((c, idx) => {
              return (
                <Comment
                  key={idx}
                  comment={c}
                  post={post}
                  updatePost={updatePost}
                />
              );
            })}
          </div>
        </li>
      </ul>
    );
  }
}

function getHeader(post) {
  let header, postText;
  if (post.is_link) {
    header = (
      <h1>
        <a href={post.link} target="_blank" rel="noopener noreferrer">
          {post.title}
        </a>
        </h1>
    );
    postText = '';
  } else {
    header = (
      <h1>
        <Link to={`/r/${post.subreddit}/${post.id}/${post.slug}/comments`}>
          {post.title}
        </Link>
      </h1>
    );
    postText = <p>{post.text}</p>;
  }
  return [header, postText];
}

class CommentsPage extends Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.updateComments = this.updateComments.bind(this);
    
  }

  updateComments() {
    const {name, id, slug} = this.props.match.params;
    fetch(`/r/${name}/${id}/${slug}/comments/`)
      .then(response => {
        if (response.status !== 200) {
          console.warn('uh oh');
        }
        return response.json();
      })
      .then(data => this.setState({post: data.post}));
  }

  componentDidMount() {
    this.updateComments();
  }

  render() {
    if (!this.state.post) {
      return <div></div>;
    }
    const post = this.state.post;
    let [header, postText] = getHeader(post);

    return (
      <div>
        <Link to={`/r/${post.subreddit}/`}>/r/{post.subreddit}</Link>
        {header}
        {postText}
        <p>{post.score} point{post.score === 1 ? '' : 's'}</p>
        <p>Submitted at {post.created} by {post.author}</p>
        <p>{post.numComments} comment{post.numComments === 1 ? '' : 's'}</p>
        <hr />
        <CommentForm
          postId={this.state.post.id}
          updatePost={this.updateComments}
          updateParent={(x)=>{}}
          topComment={true}
        />
        {post.comments.map((comment, idx) => {
          return (
            <Comment
              key={idx}
              comment={comment}
              post={this.state.post}
              updatePost={this.updateComments}
            />
          );
        })}
      </div>
    );
  }
}

class Subreddit extends Component {
  constructor(props) {
    super(props);
    this.state = {posts: [], error: false};
  }

  componentDidMount() {
    fetch(`/r/${this.props.match.params.name}/`)
      .then(response => {
        if (response.status !== 200) {
          return this.setState({error: true});
        }
        return response.json();
      })
      .then(data => this.setState({posts: data.posts}));
  }

  render() {
    let posts;
    if (this.state.error) {
      posts = <p>There was an error rendering posts</p>;
    } else if (this.state.posts.length === 0) {
      posts = <p>No posts to show</p>;
    } else {
      posts = this.state.posts.map((post, idx) => {
        return (
          <Post
            post={post}
            key={idx}
          />
        );
      });
    }
    const { name } = this.props.match.params;
    return (
      <div>
        <h1>/r/{this.props.match.params.name}</h1>
        <Link to={`/r/${name}/create-text-post`}>Create Text Post</Link>
        <br />
        <Link to={`/r/${name}/create-link-post`}>Create Link Post</Link>
        <h2>Posts:</h2>
        <div>
          {posts}
        </div>
      </div>
    );
  }
}

class Post extends Component {
  render() {
    const post = this.props.post;
    let [header, _] = getHeader(post);
    return (
      <div>
        {header}
        <p><Link to={`/r/${post.subreddit}`}>/r/{post.subreddit}</Link></p>
        <p>
          <Link to={`/r/${post.subreddit}/${post.id}/${post.slug}/comments`}>
            {post.numComments} Comment{post.numComments === 1 ? '' : 's'}
          </Link>
        </p>
        <p>{post.score} point{post.score === 1 ? '' : 's'}</p>
      </div>
    );
  }
}

class RegistrationLoginForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      username: '',
      email: '',
      password: '',
      errors: []
    };
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleInputChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    });
  }

  handleSubmit(event) {
    const endpoint = this.props.registration ? 'users/' : 'users/login/';
    fetch(`/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: {
          username: this.state.username,
          email: this.state.email,
          password: this.state.password
        }
      })
    })
      .then(response => response.json())
      .then(data => {
        if (data.errors) {
          let formattedErrors = [];
          for (let [errorKey, [errorMessage, ..._]] of Object.entries(data.errors)) {
            formattedErrors.push({
              key: errorKey,
              message: errorMessage
            });
          }
          this.setState({errors: formattedErrors});
        } else {
          localStorage.setItem('username', data.user.username);
          localStorage.setItem('jwtToken', data.user.token);
          this.props.login(data.user);
        }
      });
    event.preventDefault();
  }

  render() {
    let error = '';
    if (this.state.errors.length > 0) {
      error = this.state.errors.map(e => {
        return (
          <Alert variant="danger">
            {e.key}: {e.message}
          </Alert>
        );
      });
    }
    return (
      <div>
        <p><strong>{this.props.registration ? 'Or register' : 'Login'}</strong></p>
        {error}
        <Form onSubmit={this.handleSubmit}>
          <Col xs={2}>
            <Form.Control
              name="username"
              placeholder="username"
              size="sm"
              onChange={this.handleInputChange}
            />
          </Col>
          {this.props.registration ?
           (<Col xs={2}>
              <Form.Control
                name="email"
                type="email"
                placeholder="email (optional)"
                size="sm"
                onChange={this.handleInputChange}
              />
            </Col>) : ''}
          <Col xs={2}>
            <Form.Control
              name="password"
              type="password"
              placeholder="password"
              size="sm"
              onChange={this.handleInputChange}
            />
          </Col>
          <Col>
            <Button type="submit" size="sm">Submit</Button>
          </Col>
        </Form>
      </div>
    );
  }
}

function authenticated() {
  return localStorage.getItem('username') && localStorage.getItem('jwtToken');
}

class CreateNewSubredditForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      redirect: false,
      name: ''
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  handleSubmit(event) {
    fetch('/subreddit/create/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${localStorage.getItem('jwtToken')}`
      },
      body: JSON.stringify({
        subreddit: {
          name: this.state.name
        }
      })
    })
      .then(response => response.json())
      .then(data => {
        if (data.errors) {

        } else {
          this.setState({
            redirect: true
          });
        }
      });
    event.preventDefault();
  }

  handleChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    });
  }

  renderRedirect() {
    if (this.state.redirect) {
      return <Redirect to={`/r/${this.state.name}`} />;
    }
    return '';
  }

  render() {
    return (
      <div>
        {this.renderRedirect()}
        <Form inline onSubmit={this.handleSubmit}>
          <Form.Control
            placeholder="Subreddit Name"
            name="name"
            onChange={this.handleChange}
          />
          <Button type="submit">Create New Subreddit</Button>
        </Form>
      </div>
    );
  }
}

class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      posts: [],
    };
  }

  componentDidMount() {
    fetch('/posts/')
      .then(response => {
        if (response.status !== 200) {
          return console.warn('Uh oh');
        }
        return response.json();
      })
      .then(data => this.setState({posts: data.posts}));
  }

  render() {
    let createSubreddit = '';
    if (authenticated()) {
      createSubreddit = <CreateNewSubredditForm />;
    }
    return (
      <div>
        {createSubreddit}
        {this.state.posts.map((post, idx) => {
          return (
            <Post
              post={post}
              key={idx}
            />
          );
        })}
      </div>
    );
  }
}

class CreatePost extends Component {
  constructor(props) {
    super(props);
    this.state = {
      title: '',
      text: '',
      link:'',
      is_link: this.props.link
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  handleSubmit(event) {
    console.log(this.state.link);
    fetch(`/r/${this.props.match.params.name}/create-post/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${localStorage.getItem('jwtToken')}`
      },
      body: JSON.stringify({
        post: {
          title: this.state.title,
          is_link: this.state.is_link,
          text: this.state.text,
          link: this.state.link
        }})
    })
      .then(response => response.json())
      .then(data => {
        this.setState({
          redirectTo: `/r/${data.subreddit}/${data.id}/${data.slug}/comments`
        });
      });
    event.preventDefault();
  }

  handleChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    });
    console.log(event.target.name, ':', event.target.value);
  }

  render() {
    let redirect = '';
    if (this.state.redirectTo) {
      redirect = <Redirect to={this.state.redirectTo} />;
    }
    let body;
    if (this.props.link) {
      body = (
        <Form.Group as={Col} md="6" controlId="link">
          <Form.Label>Link</Form.Label>
          <Form.Control
            onChange={this.handleChange}
            type="url"
            name="link"
            placeholder="http://example.com"
          />
        </Form.Group>
      );
    } else {
      body = (
        <Form.Group as={Col} md="6" controlId="text">
          <Form.Label>Text</Form.Label>
          <Form.Control
            onChange={this.handleChange}
            as="textarea"
            name="text"
            placeholder="Text (Optional)"
            rows="10"
          />
        </Form.Group>
      );
    }
    return (
      <div>
        {redirect}
        <h1>
          <Link to={`/r/${this.props.match.params.name}`}>
            /r/{this.props.match.params.name}
          </Link>
        </h1>
        <h2>Create new {this.props.link ? 'link' : 'text'} post:</h2>
        <Form onSubmit={this.handleSubmit}>
          <Form.Group as={Col} md="6" controlId="title">
            <Form.Label>Title</Form.Label>
            <Form.Control
              onChange={this.handleChange}
              placeholder="Title"
              name="title"
            />
          </Form.Group>
          {body}
          <Col>
            <Button type="submit">Submit</Button>
          </Col>
        </Form>
      </div>
    );
  }
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loggedIn: false
    };
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
  }

  login(user) {
    this.setState({
      loggedIn: true,
      user: user
    });
  }

  logout() {
    localStorage.clear();
    this.setState({
      loggedIn: false,
      user: undefined
    });
  }

  componentDidMount() {
    if (authenticated()) {
      this.setState({
        loggedIn: true,
        user: {
          username: localStorage.getItem('username')
        }
      });
    }
  }

  render() {
    let userInfo;
    let logoutLink = '';
    if (this.state.loggedIn) {
      userInfo = <p>Welcome {this.state.user.username}</p>;
      logoutLink = <Nav.Link href="#" onClick={this.logout}>Logout</Nav.Link>;
    } else {
      userInfo = (
        <div>
          <RegistrationLoginForm login={this.login} registration={false} />
          <RegistrationLoginForm login={this.login} registration={true} />
        </div>
      );
    }
    return (
      <Router>
        <Navbar bg="dark" variant="dark">
          <Navbar.Brand href="/">Reddit Clone</Navbar.Brand>
          <Nav className="mr-auto">
            {logoutLink}
          </Nav>
        </Navbar>
        {userInfo}
        <Route exact path="/" component={Home} />
        <Switch>
          <Route path="/r/:name/:id/:slug/comments" component={CommentsPage}/>
          <Route
            path="/r/:name/create-text-post"
            render={(props) => <CreatePost {...props} link={false} />}
          />
          <Route
            path="/r/:name/create-link-post"
            render={(props) => <CreatePost {...props} link={true} />}
          />
          <Route path="/r/:name" component={Subreddit} />
        </Switch>
      </Router>
    );
  }
}

export default App;
